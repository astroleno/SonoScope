/**
 * SonoScope 核心类型定义
 * 包含所有事件、状态和插件的类型定义
 */
// 错误类型
export class SonoScopeError extends Error {
    code;
    context;
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'SonoScopeError';
    }
}
//# sourceMappingURL=index.js.map