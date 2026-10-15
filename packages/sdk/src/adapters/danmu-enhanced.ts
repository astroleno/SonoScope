import { SimpleDanmuAdapter } from './danmu-simple';
export interface DanmuCoreFeatures { [key: string]: unknown }
export class EnhancedDanmuAdapter extends SimpleDanmuAdapter {
  fromJson(input: string | object) { try { const value = typeof input === 'string' ? JSON.parse(input) : input; if (typeof value?.text === 'string') this.trigger({ text: value.text }); } catch { /* malformed manual input */ } }
  generateFeatureSummary(features: DanmuCoreFeatures) { return Object.keys(features).sort().join(', '); }
}
