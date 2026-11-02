// Shared path locks for live-file mutations in this isolate. Origin is deliberately
// excluded: alternate hostnames serving the same binding must also conflict.
// Binding object identity scopes locks to a database. This is NOT distributed CAS.
const databases = new WeakMap();

export function acquireFileLocks(env, paths) {
    const binding = env.img_url || env.img_d1;
    let active = databases.get(binding);
    if (!active) { active = new Set(); databases.set(binding, active); }
    const keys = [...new Set(paths)].sort();
    // All-or-nothing synchronous acquisition: no waits, partial locks or deadlocks.
    if (keys.some(path => active.has(path))) {
        throw Object.assign(new Error('文件正在处理中，请刷新后重试'), { status: 409 });
    }
    keys.forEach(path => active.add(path));
    return () => keys.forEach(path => active.delete(path));
}
