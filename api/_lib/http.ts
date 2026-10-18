import type { IncomingHttpHeaders } from 'node:http';
import type { Request, Response } from 'express';

/**
 * Request/response types for the /api handlers. They're plain Express
 * objects, so the handlers run in the self-hosted server (server/index.ts)
 * on any Node host.
 */
export type ApiRequest = Request;
export type ApiResponse = Response;

/** Anything with request headers — an API request or a WebSocket upgrade. */
export type HasHeaders = { headers: IncomingHttpHeaders };
