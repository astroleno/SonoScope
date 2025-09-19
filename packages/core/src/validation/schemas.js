/**
 * JSON Schema 验证器
 * 使用 ajv 进行数据契约验证
 */
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });
// FeatureTick Schema
const featureTickSchema = {
    type: 'object',
    properties: {
        t: { type: 'number' },
        rms: { type: 'number', minimum: 0, maximum: 1 },
        centroid: { type: 'number', minimum: 0 },
        flux: { type: 'number', minimum: 0, maximum: 1 },
        onsetRate: { type: 'number', minimum: 0 },
        bpm: { type: 'number', minimum: 0, maximum: 300, nullable: true },
        pitch: { type: 'number', minimum: 0, nullable: true },
        version: { type: 'string' }
    },
    required: ['t', 'rms', 'centroid', 'flux', 'onsetRate', 'version'],
    additionalProperties: false
};
// VisualPreset Schema
const visualPresetSchema = {
    type: 'object',
    properties: {
        bg: { type: 'string' },
        particleSpeed: { type: 'number', minimum: 0, maximum: 10 },
        particleDensity: { type: 'number', minimum: 0, maximum: 1000 },
        blur: { type: 'number', minimum: 0, maximum: 10 },
        accentHue: { type: 'number', minimum: 0, maximum: 360 },
        fontWeight: { type: 'number', minimum: 100, maximum: 900 }
    },
    required: ['bg', 'particleSpeed', 'particleDensity', 'blur', 'accentHue', 'fontWeight'],
    additionalProperties: false
};
// DecisionEvent Schema (联合类型)
const decisionEventSchema = {
    oneOf: [
        {
            type: 'object',
            properties: {
                type: { type: 'string', const: 'style.switch' },
                style: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                cooldownMs: { type: 'number', minimum: 0 }
            },
            required: ['type', 'style', 'confidence', 'cooldownMs'],
            additionalProperties: false
        },
        {
            type: 'object',
            properties: {
                type: { type: 'string', const: 'preset.suggest' },
                params: visualPresetSchema,
                ttlMs: { type: 'number', minimum: 0 }
            },
            required: ['type', 'params', 'ttlMs'],
            additionalProperties: false
        },
        {
            type: 'object',
            properties: {
                type: { type: 'string', const: 'danmu.text' },
                text: { type: 'string', maxLength: 12 },
                tone: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
                lifeMs: { type: 'number', minimum: 0 }
            },
            required: ['type', 'text', 'tone', 'lifeMs'],
            additionalProperties: false
        }
    ]
};
// 编译验证器
export const validateFeatureTick = ajv.compile(featureTickSchema);
export const validateVisualPreset = ajv.compile(visualPresetSchema);
export const validateDecisionEvent = ajv.compile(decisionEventSchema);
/**
 * 验证 FeatureTick 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export function validateFeatureTickData(data) {
    return validateFeatureTick(data);
}
/**
 * 验证 VisualPreset 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export function validateVisualPresetData(data) {
    return validateVisualPreset(data);
}
/**
 * 验证 DecisionEvent 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export function validateDecisionEventData(data) {
    return validateDecisionEvent(data);
}
/**
 * 获取验证错误信息
 * @param validator ajv 验证器
 * @returns 错误信息数组
 */
export function getValidationErrors(validator) {
    if (!validator.errors)
        return [];
    return validator.errors.map((error) => `${error.instancePath || 'root'}: ${error.message}`);
}
//# sourceMappingURL=schemas.js.map