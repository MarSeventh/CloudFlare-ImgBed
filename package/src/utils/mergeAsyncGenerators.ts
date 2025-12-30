/**
 * Merge outputs of multiple async generators.
 */
export async function* mergeAsyncGenerators<T>(generators: AsyncGenerator<T>[]): AsyncGenerator<T> {
	const executing: Promise<{ result: IteratorResult<T>; gen: AsyncGenerator<T> }>[] = [];

	const generatorSymbol = Symbol("generator");

	for (const gen of generators) {
		const p = gen.next().then((result) => ({ result, gen }));
		Object.defineProperty(p, generatorSymbol, {
			value: gen,
		});
		executing.push(p);
	}

	while (executing.length > 0) {
		const next = await Promise.race(executing);
		const { result, gen } = next;

		const index = executing.findIndex((p) => Object.getOwnPropertyDescriptor(p, generatorSymbol)?.value === gen);

		if (result.done) {
			executing.splice(index, 1);
			continue;
		}

		yield result.value;
		executing[index] = gen.next().then((result) => ({ result, gen }));
		Object.defineProperty(executing[index], generatorSymbol, {
			value: gen,
		});
	}
}
