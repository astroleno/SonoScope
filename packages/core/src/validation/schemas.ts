/**
 * JSON Schema 验证器
 * 使用 ajv 进行数据契约验证
 */

import Ajv, { JSONSchemaType } from 'ajv';
// 避免循环依赖，直接定义类型
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

const ajv = new Ajv({ allErrors: true });

// FeatureTick Schema
const featureTickSchema: JSONSchemaType<FeatureTick> = {
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
const visualPresetSchema: JSONSchemaType<VisualPreset> = {
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
export function validateFeatureTickData(data: unknown): data is FeatureTick {
  return validateFeatureTick(data);
}

/**
 * 验证 VisualPreset 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export function validateVisualPresetData(data: unknown): data is VisualPreset {
  return validateVisualPreset(data);
}

/**
 * 验证 DecisionEvent 数据
 * @param data 待验证的数据
 * @returns 验证结果
 */
export function validateDecisionEventData(data: unknown): data is DecisionEvent {
  return validateDecisionEvent(data);
}

/**
 * 获取验证错误信息
 * @param validator ajv 验证器
 * @returns 错误信息数组
 */
export function getValidationErrors(validator: any): string[] {
  if (!validator.errors) return [];
  return validator.errors.map((error: any) => 
    `${error.instancePath || 'root'}: ${error.message}`
  );
}
