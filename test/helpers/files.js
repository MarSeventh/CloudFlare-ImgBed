export function png() {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 400);
    view.setUint32(20, 200);
    return bytes;
}
