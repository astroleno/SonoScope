import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export class ServiceError extends Error {
  constructor(public code: string, public status: number, message: string, public retryAfterSeconds?: number) { super(message); }
}
export interface Reservation {
  requestId: string; fingerprint: string; day: string; state: 'reserved' | 'sent' | 'settled' | 'released';
  expiresAt: number; tokenUpperBound: number; actualTokens: number | null; digest: string;
}
type Ledger = { version: 1; days: Record<string, { calls: number; tokens: number }>; reservations: Record<string, Reservation>; rates: Record<string, number[]> };
function validLedger(value: unknown): value is Ledger {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  if (!record(value) || value.version !== 1 || !record(value.days) || !record(value.reservations) || !record(value.rates)) return false;
  for (const [day, usage] of Object.entries(value.days)) if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !record(usage) || !count(usage.calls) || !count(usage.tokens)) return false;
  for (const [id, r] of Object.entries(value.reservations)) {
    if (!record(r) || r.requestId !== id || ['__proto__', 'constructor', 'prototype'].includes(id) || typeof r.fingerprint !== 'string' || typeof r.digest !== 'string' || typeof r.day !== 'string' || !Object.hasOwn(value.days, r.day) || !['reserved', 'sent', 'settled', 'released'].includes(String(r.state)) || !count(r.expiresAt) || !count(r.tokenUpperBound) || (r.actualTokens !== null && !count(r.actualTokens))) return false;
  }
  for (const rate of Object.values(value.rates)) if (!Array.isArray(rate) || rate.length > 5 || !rate.every(count)) return false;
  return true;
}
export interface QuotaLimits { dailyCalls: number; dailyTokens: number; concurrency: number }
/** Durable single-process store. Atomic rename + fsync, locked for the lifetime of the service. */
export class FileQuotaStore {
  private chain: Promise<unknown> = Promise.resolve();
  private ledger: Ledger | null = null;
  private lock: string;
  private path: string;
  private locked = false;
  constructor(path: string, private limits: QuotaLimits, private now: () => number = Date.now) { this.path = resolve(path); this.lock = this.path + '.lock'; }
  private async init() {
    if (this.ledger) return;
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    try {
      const handle = await open(this.lock, 'wx', 0o600); await handle.writeFile(String(process.pid)); await handle.close(); this.locked = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const pid = Number(await readFile(this.lock, 'utf8'));
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new ServiceError('quota-store-busy', 503, 'AI 配额锁需要检查。');
      try { process.kill(pid, 0); throw new ServiceError('quota-store-busy', 503, 'AI 配额服务正在使用中。'); }
      catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause;
        await unlink(this.lock); const handle = await open(this.lock, 'wx', 0o600); await handle.writeFile(String(process.pid)); await handle.close(); this.locked = true;
      }
    }
    try {
      const data: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      if (!validLedger(data)) throw new Error('Invalid quota ledger');
      this.ledger = data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') this.ledger = { version: 1, days: {}, reservations: {}, rates: {} };
      else { await this.closeLock(); throw new ServiceError('quota-store-invalid', 503, 'AI 配额记录需要恢复；本地反馈继续工作。'); }
    }
  }
  private async save() {
    const tmp = `${this.path}.${process.pid}.tmp`;
    const handle = await open(tmp, 'w', 0o600);
    try { await handle.writeFile(JSON.stringify(this.ledger)); await handle.sync(); } finally { await handle.close(); }
    await rename(tmp, this.path);
    const dir = await open(dirname(this.path), 'r'); try { await dir.sync(); } finally { await dir.close(); }
  }
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn); this.chain = next.catch(() => undefined); return next;
  }
  reserve(requestId: string, digest: string, fingerprint: string, tokenUpperBound: number) {
    return this.exclusive(async () => {
      await this.init(); const ledger = this.ledger!, now = this.now(), day = new Date(now).toISOString().slice(0, 10);
      const existing = Object.hasOwn(ledger.reservations, requestId) ? ledger.reservations[requestId] : null;
      if (existing) throw new ServiceError(existing.digest === digest ? 'duplicate-request' : 'request-id-conflict', 409, '这次请求已处理，请等待已有结果。');
      if (['__proto__', 'constructor', 'prototype'].includes(requestId)) throw new ServiceError('invalid-request', 400, '请求 ID 无效。');
      for (const r of Object.values(ledger.reservations)) if ((r.state === 'sent' || r.state === 'reserved') && r.expiresAt < now) { r.state = 'settled'; r.actualTokens = r.tokenUpperBound; }
      const active = Object.values(ledger.reservations).filter(r => r.state === 'reserved' || r.state === 'sent');
      if (active.length >= this.limits.concurrency) throw new ServiceError('concurrency-limit', 429, 'AI 正在忙，请稍后再试。', 8);
      if (active.some(r => r.fingerprint === fingerprint)) throw new ServiceError('client-busy', 429, '已有 AI 请求正在处理。', 8);
      const rate = (ledger.rates[fingerprint] ?? []).filter(t => now - t < 60000);
      if (rate.length >= 5 || (rate.length && now - rate[rate.length - 1] < 10000)) throw new ServiceError('rate-limit', 429, 'AI 请求太频繁，请稍后再试。', 12);
      const used = ledger.days[day] ?? { calls: 0, tokens: 0 };
      if (used.calls >= this.limits.dailyCalls || used.tokens + tokenUpperBound > this.limits.dailyTokens) throw new ServiceError('daily-limit', 429, '今天的 AI 额度已用完；本地反馈继续工作。', Math.ceil((Date.parse(day + 'T00:00:00Z') + 86400000 - now) / 1000));
      used.calls++; used.tokens += tokenUpperBound; ledger.days[day] = used;
      const reservation: Reservation = { requestId, fingerprint, day, state: 'reserved', expiresAt: now + 30000, tokenUpperBound, actualTokens: null, digest };
      ledger.reservations[requestId] = reservation; ledger.rates[fingerprint] = [...rate, now];
      for (const [key, r] of Object.entries(ledger.reservations)) if (Date.parse(r.day + 'T00:00:00Z') < now - 3 * 86400000 && r.state !== 'sent' && r.state !== 'reserved') delete ledger.reservations[key];
      for (const [key, times] of Object.entries(ledger.rates)) if (!times.some(t => now - t < 60000)) delete ledger.rates[key];
      for (const key of Object.keys(ledger.days)) if (Date.parse(key + 'T00:00:00Z') < now - 30 * 86400000) delete ledger.days[key];
      await this.save(); return { ...reservation };
    });
  }
  markSent(requestId: string) { return this.exclusive(async () => { await this.init(); const r = this.ledger!.reservations[requestId]; if (!r || r.state !== 'reserved') throw new Error('Invalid reservation'); r.state = 'sent'; await this.save(); }); }
  settle(requestId: string, tokens: number | null) { return this.exclusive(async () => {
    await this.init(); const r = this.ledger!.reservations[requestId]; if (!r || r.state === 'settled' || r.state === 'released') return;
    const actual = tokens !== null && Number.isFinite(tokens) && tokens >= 0 ? Math.ceil(tokens) : r.tokenUpperBound;
    this.ledger!.days[r.day].tokens += actual - r.tokenUpperBound; r.actualTokens = actual; r.state = 'settled'; await this.save();
  }); }
  release(requestId: string) { return this.exclusive(async () => {
    await this.init(); const r = this.ledger!.reservations[requestId]; if (!r || r.state !== 'reserved') return;
    this.ledger!.days[r.day].calls--; this.ledger!.days[r.day].tokens -= r.tokenUpperBound; r.state = 'released'; await this.save();
  }); }
  snapshot() { return this.exclusive(async () => { await this.init(); return JSON.parse(JSON.stringify(this.ledger)) as Ledger; }); }
  private async closeLock() { if (this.locked) { this.locked = false; await unlink(this.lock).catch(() => undefined); } }
  close() { return this.exclusive(() => this.closeLock()); }
}
