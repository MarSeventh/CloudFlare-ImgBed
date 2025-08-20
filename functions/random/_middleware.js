import { checkKVConfig } from '../utils/middleware';

export const onRequest = [checkKVConfig];