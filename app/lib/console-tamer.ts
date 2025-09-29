/**
 * 轻量 Console 限流/采样工具
 * - 提供按 key 的时间节流（同一 key 在窗口内最多输出一次）
 * - 提供采样概率（例如 0.1 表示 10% 机会输出）
 * - 统一等级开关与全局禁用
 * - 保留 try-catch，避免日志本身导致异常
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ConsoleTamerOptions {
  /**
   * 每个 key 的节流窗口（毫秒）。同一 key 在窗口内最多输出一次。
   * 默认 1000ms
   */
  throttleWindowMs?: number;
  /**
   * 采样概率 [0,1]。默认 1（不采样，全量输出）。
   */
  sampleRate?: number;
  /**
   * 全局启用开关。默认 true。
   */
  enabled?: boolean;
  /**
   * 允许输出的最小级别（低于该级别的输出被忽略）。默认 'debug'。
   */
  minLevel?: LogLevel;
}

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class ConsoleTamerImpl {
  private lastLogTimeByKey: Map<string, number> = new Map();
  private options: Required<ConsoleTamerOptions> = {
    throttleWindowMs: 1000,
    sampleRate: 1,
    enabled: true,
    minLevel: 'debug',
  };

  configure(partial: ConsoleTamerOptions): void {
    this.options = { ...this.options, ...partial };
  }

  /**
   * 条件输出日志
   * @param level 日志等级
   * @param key 用于节流的键（同一 key 在窗口内最多输出一次）
   * @param args console 参数
   */
  log(level: LogLevel, key: string, ...args: any[]): void {
    try {
      if (!this.options.enabled) return;
      if (levelPriority[level] < levelPriority[this.options.minLevel]) return;

      // 采样
      if (this.options.sampleRate < 1) {
        if (Math.random() > Math.max(0, Math.min(1, this.options.sampleRate))) return;
      }

      const now = Date.now();
      const last = this.lastLogTimeByKey.get(key) || 0;
      if (now - last < this.options.throttleWindowMs) return;
      this.lastLogTimeByKey.set(key, now);

      // 输出
      const prefix = `[${level.toUpperCase()}][${key}]`;
      switch (level) {
        case 'debug':
          // @ts-ignore
          console.debug?.(prefix, ...args);
          break;
        case 'info':
          console.info?.(prefix, ...args);
          break;
        case 'warn':
          console.warn?.(prefix, ...args);
          break;
        case 'error':
          console.error?.(prefix, ...args);
          break;
      }
    } catch (_) {
      // 忽略日志内部错误，避免影响主流程
    }
  }

  debug(key: string, ...args: any[]) { this.log('debug', key, ...args); }
  info(key: string, ...args: any[]) { this.log('info', key, ...args); }
  warn(key: string, ...args: any[]) { this.log('warn', key, ...args); }
  error(key: string, ...args: any[]) { this.log('error', key, ...args); }
}

export const ConsoleTamer = new ConsoleTamerImpl();

// 默认根据环境变量进行基础配置（若存在）
try {
  const env = (typeof process !== 'undefined' ? (process as any).env : (window as any)?.process?.env) || {};
  const enabled = String(env.NEXT_PUBLIC_LOG_ENABLED ?? 'true') !== 'false';
  const minLevel = (env.NEXT_PUBLIC_LOG_LEVEL ?? 'debug') as LogLevel;
  const sample = Number(env.NEXT_PUBLIC_LOG_SAMPLE ?? '1');
  const throttle = Number(env.NEXT_PUBLIC_LOG_THROTTLE_MS ?? '1000');
  ConsoleTamer.configure({ enabled, minLevel, sampleRate: isNaN(sample) ? 1 : sample, throttleWindowMs: isNaN(throttle) ? 1000 : throttle });
} catch (_) {
  // 静默失败
}


