/**
 * SQLite D1 适配器
 * 使用 better-sqlite3 模拟 Cloudflare D1 的 API 接口
 * 使得现有的 d1Database.js 无需修改即可在 Node.js 中运行
 */

import Database from 'better-sqlite3';

export class SqliteD1 {
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
    }

    /**
     * 初始化数据库（执行 SQL 脚本）
     */
    exec(sql) {
        this.db.exec(sql);
    }

    /**
     * 模拟 D1 的 prepare 方法
     * 返回一个具有 bind/first/all/run 方法的对象
     */
    prepare(sql) {
        const db = this.db;
        return new SqliteD1Statement(db, sql);
    }
}

class SqliteD1Statement {
    constructor(db, sql) {
        this._db = db;
        this._sql = sql;
        this._params = [];
    }

    /**
     * 绑定参数（模拟 D1 的 bind 方法）
     */
    bind(...params) {
        // SQLite 不支持 undefined 和 boolean，转换以兼容 D1 行为
        this._params = params.map(p => {
            if (p === undefined) return null;
            if (typeof p === 'boolean') return p ? 1 : 0;
            return p;
        });
        return this;
    }

    /**
     * 获取第一行结果（模拟 D1 的 first 方法）
     * 返回 Promise 以兼容 D1 的异步接口
     */
    async first(column) {
        try {
            const stmt = this._db.prepare(this._sql);
            const row = stmt.get(...this._params);
            if (!row) return null;
            if (column) return row[column];
            return row;
        } catch (e) {
            console.error('SQLite first() error:', e.message, 'SQL:', this._sql);
            throw e;
        }
    }

    /**
     * 获取所有结果（模拟 D1 的 all 方法）
     * 返回 { results: [...] } 格式以兼容 D1
     */
    async all() {
        try {
            const stmt = this._db.prepare(this._sql);
            const rows = stmt.all(...this._params);
            return { results: rows };
        } catch (e) {
            console.error('SQLite all() error:', e.message, 'SQL:', this._sql);
            throw e;
        }
    }

    /**
     * 执行 SQL（模拟 D1 的 run 方法）
     */
    async run() {
        try {
            const stmt = this._db.prepare(this._sql);
            const result = stmt.run(...this._params);
            return {
                success: true,
                meta: {
                    changes: result.changes,
                    last_row_id: result.lastInsertRowid
                }
            };
        } catch (e) {
            console.error('SQLite run() error:', e.message, 'SQL:', this._sql);
            throw e;
        }
    }
}
