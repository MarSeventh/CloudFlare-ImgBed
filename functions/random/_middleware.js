import { checkDatabaseConfig } from '../utils/middleware';

export const onRequest = [checkDatabaseConfig];