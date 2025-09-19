/**
 * JSON Schema 验证器
 * 使用 ajv 进行数据契约验证
 */
export interface FeatureTick {
    t: number;
    rms: number;
    centroid: number;
    flux: number;
    onsetRate: number;
    bpm?: number;
    pitch?: number;
    version: string;
}
export interface VisualPreset {
    bg: string;
    particleSpeed: number;
    particleDensity: number;
    blur: number;
    accentHue: number;
    fontWeight: number;
}
export interface DecisionEvent {
    type: 'style.switch' | 'preset.suggest' | 'danmu.text';
    [key: string]: any;
}
export declare const validateFeatureTick: import("ajv").ValidateFunction<FeatureTick>;
export declare const validateVisualPreset: import("ajv").ValidateFunction<VisualPreset>;
export declare const validateDecisionEvent: import("ajv").ValidateFunction<{
    [x: string]: {};
}>;
/**
 * 验证 FeatureTick 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export declare function validateFeatureTickData(data: unknown): data is FeatureTick;
/**
 * 验证 VisualPreset 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export declare function validateVisualPresetData(data: unknown): data is VisualPreset;
/**
 * 验证 DecisionEvent 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export declare function validateDecisionEventData(data: unknown): data is DecisionEvent;
/**
 * 获取验证错误信息
 * @param validator ajv 验证器
 * @returns 错误信息数组
 */
export declare function getValidationErrors(validator: any): string[];
//# sourceMappingURL=schemas.d.ts.map