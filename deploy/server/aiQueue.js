const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_BATCH_SIZE = 5;
const LOCAL_QUEUE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS local_ai_queue (
        task_id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_ai_queue_available
        ON local_ai_queue(available_at, created_at);
`;

export class LocalAIQueue {
    constructor(options = {}) {
        if (!options.db?.prepare) throw new TypeError('LocalAIQueue.db is required');
        if (typeof options.consumer !== 'function') {
            throw new TypeError('LocalAIQueue.consumer is required');
        }
        if (typeof options.envFactory !== 'function') {
            throw new TypeError('LocalAIQueue.envFactory is required');
        }

        this.db = options.db;
        this.consumer = options.consumer;
        this.envFactory = options.envFactory;
        this.pollIntervalMs = positiveInteger(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);
        this.batchSize = positiveInteger(options.batchSize, DEFAULT_BATCH_SIZE);
        this.running = false;
        this.timer = null;
        this.db.exec?.(LOCAL_QUEUE_SCHEMA);
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            this.drain().catch(error => {
                console.error('[AI][LocalQueue] Poll failed', { message: error.message });
            });
        }, this.pollIntervalMs);
        this.timer.unref?.();
        queueMicrotask(() => this.drain().catch(error => {
            console.error('[AI][LocalQueue] Initial poll failed', { message: error.message });
        }));
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    async send(body) {
        const taskId = String(body?.taskId || '');
        if (!taskId) throw new TypeError('Local AI queue taskId is required');

        await this.db.prepare(
            'INSERT OR IGNORE INTO local_ai_queue ' +
            '(task_id, body, attempts, available_at, created_at, updated_at) ' +
            'VALUES (?, ?, 0, ?, ?, ?)'
        ).bind(taskId, JSON.stringify(body), Date.now(), Date.now(), Date.now()).run();

        queueMicrotask(() => this.drain().catch(error => {
            console.error('[AI][LocalQueue] Dispatch failed', {
                taskId,
                message: error.message
            });
        }));
    }

    async drain() {
        if (this.running) return;
        this.running = true;
        try {
            const result = await this.db.prepare(
                'SELECT task_id, body, attempts FROM local_ai_queue ' +
                'WHERE available_at <= ? ORDER BY created_at LIMIT ?'
            ).bind(Date.now(), this.batchSize).all();
            const rows = result.results || [];
            if (!rows.length) return;

            const messages = [];
            for (const row of rows) {
                const attempts = Number(row.attempts || 0) + 1;
                await this.db.prepare(
                    'UPDATE local_ai_queue SET attempts = ?, updated_at = ? WHERE task_id = ?'
                ).bind(attempts, Date.now(), row.task_id).run();
                messages.push(createLocalMessage(row, attempts));
            }

            await this.consumer(
                { messages },
                this.envFactory(),
                { waitUntil: promise => promise?.catch?.(error => console.error(error)) }
            );

            for (const message of messages) {
                if (message.action === 'retry') {
                    await this.db.prepare(
                        'UPDATE local_ai_queue SET available_at = ?, updated_at = ? WHERE task_id = ?'
                    ).bind(Date.now() + message.delaySeconds * 1000, Date.now(), message.id).run();
                    continue;
                }
                await this.db.prepare(
                    'DELETE FROM local_ai_queue WHERE task_id = ?'
                ).bind(message.id).run();
            }
        } finally {
            this.running = false;
        }
    }
}

function createLocalMessage(row, attempts) {
    let body;
    try {
        body = JSON.parse(row.body);
    } catch {
        body = null;
    }

    return {
        id: row.task_id,
        body,
        attempts,
        action: 'pending',
        delaySeconds: 0,
        ack() {
            this.action = 'ack';
        },
        retry(options = {}) {
            this.action = 'retry';
            this.delaySeconds = Math.max(0, Number(options.delaySeconds) || 0);
        }
    };
}

function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
}
