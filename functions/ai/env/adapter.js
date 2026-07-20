import { getDatabase } from '../../utils/databaseAdapter.js';
import { detectAIRuntime } from './detector.js';

/**
 * Wraps existing project capabilities (database / queue / background) behind a
 * single AI-internal adapter. Pipeline, Processor and Provider layers only see
 * this abstraction and never touch external modules directly.
 */
export function createAIAdapter(env = {}, context = {}) {
    const runtime = detectAIRuntime();
    const hasQueue = typeof env.img_queue?.send === 'function';

    return {
        runtime,
        env,
        database: getDatabase(env),
        hasQueue,
        async enqueue(message) {
            if (!hasQueue) {
                throw new Error('AI queue binding is unavailable');
            }
            return env.img_queue.send(message);
        },
        runBackground(task) {
            const promise = typeof task === 'function' ? Promise.resolve().then(task) : Promise.resolve(task);
            if (typeof context.waitUntil === 'function') {
                context.waitUntil(promise);
                return undefined;
            }
            return promise;
        }
    };
}
