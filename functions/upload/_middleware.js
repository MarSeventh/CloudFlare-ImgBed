import { errorHandling, telemetryData, checkKVConfig } from '../utils/middleware';

export const onRequest = [checkKVConfig, errorHandling, telemetryData];