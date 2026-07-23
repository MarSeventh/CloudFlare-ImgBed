export const AI_HOOKS = Object.freeze({
    AFTER_METADATA_PERSISTED: 'after_metadata_persisted'
});

export class AIHookRegistry {
    constructor(hookNames = Object.values(AI_HOOKS)) {
        this.hookNames = new Set(hookNames);
        this.handlers = new Map();
    }

    register(hookName, handler) {
        this.assertHookName(hookName);
        if (typeof handler !== 'function') {
            throw new TypeError('Hook handler must be a function');
        }

        const handlers = this.handlers.get(hookName) || [];
        handlers.push(handler);
        this.handlers.set(hookName, handlers);

        let registered = true;
        return () => {
            if (!registered) return false;
            registered = false;
            return this.unregister(hookName, handler);
        };
    }

    unregister(hookName, handler) {
        this.assertHookName(hookName);
        const handlers = this.handlers.get(hookName);
        if (!handlers) return false;

        const index = handlers.indexOf(handler);
        if (index === -1) return false;

        handlers.splice(index, 1);
        if (handlers.length === 0) this.handlers.delete(hookName);
        return true;
    }

    async dispatch(hookName, payload, context = {}) {
        this.assertHookName(hookName);
        const handlers = [...(this.handlers.get(hookName) || [])];
        const results = [];

        for (const handler of handlers) {
            results.push(await handler(payload, context));
        }

        return results;
    }

    hasHandlers(hookName) {
        this.assertHookName(hookName);
        return (this.handlers.get(hookName)?.length || 0) > 0;
    }

    assertHookName(hookName) {
        if (!this.hookNames.has(hookName)) {
            throw new TypeError(`Unknown AI hook: ${hookName}`);
        }
    }
}

export function createAIHookRegistry(options = {}) {
    return new AIHookRegistry(options.hookNames);
}
