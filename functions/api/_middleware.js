import { errorHandling, telemetryData } from '../utils/middleware';

export const onRequest = [errorHandling, telemetryData];