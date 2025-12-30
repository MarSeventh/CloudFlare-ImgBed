/**
 * Split an async generator into multiple async generators, all drawing from the same source.
 */
export function splitAsyncGenerator<T>(source: AsyncGenerator<T>, n: number): Array<AsyncGenerator<T>> {
	if (n <= 0) {
		return [];
	}

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	let takenIndex: number | null = null;
	const generators: AsyncGenerator<T>[] = [];
	let remaining = n;
	for (let i = 0; i < n; i++) {
		generators.push({
			next: async () => {
				while (takenIndex !== null) {
					await sleep(1);
				}
				takenIndex = i;
				return source.next().then((r) => {
					takenIndex = null;
					return r;
				});
			},
			return: async () => {
				remaining--;
				if (remaining === 0) {
					return source.return(undefined);
				}
				return {
					done: true,
					value: undefined,
				};
			},
			throw: async (error) => {
				return source.throw(error);
			},
			[Symbol.asyncIterator]: () => generators[i],
		});
	}
	return generators;
}
