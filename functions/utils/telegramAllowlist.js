// Telegram users authorized to upload through the bot and to receive files sent
// from the dashboard. Two sources are merged as a union:
//   - TG_UPLOAD_ALLOWED_USER_IDS (environment): read-only in the dashboard and
//     never persisted, so removing an ID there always revokes it;
//   - security settings `telegramBot.allowedUsers` (dashboard), with notes.

export const MAX_ALLOWED_USERS = 200;
export const MAX_NOTE_LENGTH = 64;

export function validTelegramUserId(id) {
    return typeof id === 'string' && /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id));
}

function cleanNote(note) {
    // Notes are labels only; drop control characters and bound the length.
    return typeof note === 'string' ? note.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NOTE_LENGTH) : '';
}

export function parseEnvAllowedUsers(env) {
    const raw = String(env?.TG_UPLOAD_ALLOWED_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    return { ids: [...new Set(raw.filter(validTelegramUserId))], invalid: raw.some(id => !validTelegramUserId(id)) };
}

// Lenient read of stored entries: skip anything malformed rather than fail.
export function storedAllowedUsers(value) {
    const users = [], seen = new Set();
    for (const entry of Array.isArray(value) ? value : []) {
        const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
        if (!validTelegramUserId(id) || seen.has(id)) continue;
        seen.add(id);
        users.push({ id, note: cleanNote(entry.note) });
    }
    return users.slice(0, MAX_ALLOWED_USERS);
}

// Strict validation for a dashboard save. Returns { users } or { error }.
export function validateAllowedUsers(value) {
    if (!Array.isArray(value)) return { error: 'allowedUsers must be an array' };
    if (value.length > MAX_ALLOWED_USERS) return { error: `At most ${MAX_ALLOWED_USERS} users` };
    const seen = new Set(), users = [];
    for (const entry of value) {
        const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
        if (!validTelegramUserId(id)) return { error: `Invalid Telegram user ID: ${String(entry?.id).slice(0, 32)}` };
        if (seen.has(id)) return { error: `Duplicate Telegram user ID: ${id}` };
        if (entry.note !== undefined && typeof entry.note !== 'string') return { error: 'note must be a string' };
        seen.add(id);
        users.push({ id, note: cleanNote(entry.note) });
    }
    return { users };
}

// Effective allowlist. `misconfigured` means the environment variable contains
// an entry that is not a numeric user ID; callers that grant upload access fail
// closed in that case, as before.
export function telegramAllowedUsers(env, securityConfig) {
    const fromEnv = parseEnvAllowedUsers(env);
    const users = fromEnv.ids.map(id => ({ id, note: '', source: 'env' }));
    const seen = new Set(fromEnv.ids);
    for (const user of storedAllowedUsers(securityConfig?.telegramBot?.allowedUsers)) {
        const envEntry = users.find(u => u.id === user.id);
        if (envEntry) { if (!envEntry.note) envEntry.note = user.note; continue; }
        if (!seen.has(user.id)) { seen.add(user.id); users.push({ ...user, source: 'config' }); }
    }
    return { users, misconfigured: fromEnv.invalid };
}
