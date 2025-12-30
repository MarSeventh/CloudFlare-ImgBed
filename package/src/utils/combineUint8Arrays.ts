export function combineUint8Arrays(
	a: Uint8Array<ArrayBufferLike>,
	b: Uint8Array<ArrayBufferLike>
): Uint8Array<ArrayBuffer> {
	const aLength = a.length;
	const combinedBytes = new Uint8Array(aLength + b.length);
	combinedBytes.set(a);
	combinedBytes.set(b, aLength);
	return combinedBytes;
}
