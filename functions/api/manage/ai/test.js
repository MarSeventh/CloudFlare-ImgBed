import { getAIConfig, prepareAIConfig } from '../../../utils/ai/config.js';
import { createAIContext } from '../../../utils/ai/index.js';
import { json, readJSON, errorResponse } from '../../../utils/apiResponse.js';

export async function onRequestPost(context) {
    try {
        const body = await readJSON(context.request);
        const old = await getAIConfig(context.env);
        const config = body.config ? await prepareAIConfig(body.config, old, context.env, true) : old;
        const result = await createAIContext(context.env, { config }).invoke({ capability: 'connection.test', modelId: body.modelId, signal: context.request.signal });
        return json(result);
    } catch (error) { return errorResponse(error); }
}
