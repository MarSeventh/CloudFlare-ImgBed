import { readFile } from 'node:fs/promises';
import { SqliteD1 } from '../../deploy/server/sqliteD1.js';
import { D1Database } from '../../functions/utils/d1Database.js';

// Use the real D1 adapter on the SQLite shim that the Docker deployment runs on,
// with the schema from init.sql.
export async function sqliteDatabase() {
    const sqlite = new SqliteD1(':memory:');
    sqlite.exec(await readFile('database/init.sql', 'utf8'));
    return { sqlite, db: new D1Database(sqlite) };
}
