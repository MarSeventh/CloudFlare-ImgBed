import { getDatabase } from '../../../utils/databaseAdapter.js';
import { AI_CONFIG_KEY, getAIConfig, prepareAIConfig, publicAIConfig } from '../../../utils/ai/config.js';
import { APIError, json, readJSON, errorResponse } from '../../../utils/apiResponse.js';

export async function onRequest(context) {
    try {
        const old = await getAIConfig(context.env);
        if (context.request.method === 'GET') return json(publicAIConfig(old, context.env));
        if (context.request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST.' } }, 405);
        const input = await readJSON(context.request);
        if (input.revision !== old.revision) throw new APIError('CONFIG_CONFLICT', 'AI settings changed. Reload before saving.', 409);
        const config = await prepareAIConfig(input, old, context.env);
        config.revision = old.revision + 1;
        await getDatabase(context.env).put(AI_CONFIG_KEY, JSON.stringify(config));
        return json(publicAIConfig(config, context.env));
    } catch (error) { return errorResponse(error); }
}
