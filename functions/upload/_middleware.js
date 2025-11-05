import { errorHandling, telemetryData, checkDatabaseConfig } from '../utils/middleware';

export const onRequest = [checkDatabaseConfig, errorHandling, telemetryData];