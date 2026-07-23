/**
 * A Processor owns exactly one metadata field. It calls a Provider for the raw
 * model output and returns a MetadataPatch. It never writes the database and
 * never knows which environment it runs in.
 */
export class MetadataProcessor {
    get field() {
        throw new Error('MetadataProcessor.field is not implemented');
    }

    get capability() {
        throw new Error('MetadataProcessor.capability is not implemented');
    }

    async process() {
        throw new Error('MetadataProcessor.process is not implemented');
    }
}
