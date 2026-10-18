import { randomUUID } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './_lib/http.js';
import {
  clearAdminSession,
  clearSessionCookies,
  getAccessSession,
  getAdminSession,
  setAccessSession,
  setAdminSession
} from './_lib/session.js';
import {
  adminCodeHash,
  clearFailures,
  communityCodeConfigured,
  communityCodeInfo,
  getAccessCodeVersion,
  isThrottled,
  recordFailure,
  setCommunityCode,
  verifyAdminCode,
  verifyCommunityCode
} from './_lib/accessCode.js';

/**
 * /api/auth/:action — shared-code access (no individual accounts):
 *   POST access            { code }  community code → device unlocked; the admin
 *                                    code also works here → staff pass ({ admin: true })
 *   POST admin-login       { code }  admin code → staff pass (+ community access)
 *   POST logout                      lock this device
 *   GET  me                          { access, admin }
 *   GET  admin-access-info           staff: where the community code comes from
 *   POST admin-set-access-code { code }  staff: change the community code
 */

const WRONG_CODE = 'That code is not right.';
const THROTTLED = 'Too many tries from this device. Wait 15 minutes and try again.';

function methodNotAllowed(res: ApiResponse) {
  res.status(405).json({ error: 'Method not allowed' });
}

function clientIp(req: ApiRequest): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function bodyCode(req: ApiRequest): unknown {
  return (req.body as { code?: unknown } | undefined)?.code;
}

/**
 * The single code box everyone sees (the site's front page). The code
 * decides the role: the community code gives a resident pass (dropping any
 * staff pass on this device); the admin code gives a staff pass.
 */
async function handleAccess(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const ip = clientIp(req);
  if (isThrottled('community', ip)) {
    res.status(429).json({ error: THROTTLED });
    return;
  }
  const code = bodyCode(req);
  if (communityCodeConfigured() && (await verifyCommunityCode(code))) {
    clearFailures('community', ip);
    clearAdminSession(res);
    await setAccessSession(res, { role: 'community', sid: randomUUID(), v: getAccessCodeVersion() });
    res.status(200).json({ ok: true, admin: false });
    return;
  }
  if (await verifyAdminCode(code)) {
    clearFailures('community', ip);
    await setAdminSession(res);
    res.status(200).json({ ok: true, admin: true });
    return;
  }
  if (!communityCodeConfigured()) {
    res.status(503).json({ error: 'The community access code is not set up on the server yet.' });
    return;
  }
  recordFailure('community', ip);
  res.status(401).json({ error: WRONG_CODE });
}

async function handleAdminLogin(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!adminCodeHash()) {
    res.status(503).json({ error: 'The admin code is not set up on the server (ADMIN_CODE_HASH).' });
    return;
  }
  const ip = clientIp(req);
  if (isThrottled('admin', ip)) {
    res.status(429).json({ error: THROTTLED });
    return;
  }
  if (!(await verifyAdminCode(bodyCode(req)))) {
    recordFailure('admin', ip);
    res.status(401).json({ error: WRONG_CODE });
    return;
  }
  clearFailures('admin', ip);
  await setAdminSession(res);
  res.status(200).json({ ok: true });
}

async function handleLogout(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  clearSessionCookies(res);
  res.status(200).json({ ok: true });
}

async function handleMe(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const [access, admin] = await Promise.all([getAccessSession(req), getAdminSession(req)]);
  res.status(200).json({
    access: access ? { deviceId: access.sid } : null,
    admin: admin ? { role: 'admin' } : null
  });
}

async function requireAdmin(req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (await getAdminSession(req)) return true;
  res.status(401).json({ error: 'Staff login required.' });
  return false;
}

async function handleAdminAccessInfo(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (!(await requireAdmin(req, res))) return;
  res.status(200).json({ ...communityCodeInfo(), configured: communityCodeConfigured() });
}

async function handleAdminSetAccessCode(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!(await requireAdmin(req, res))) return;
  try {
    await setCommunityCode(bodyCode(req));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid code.' });
    return;
  }
  res.status(200).json({ ok: true, ...communityCodeInfo() });
}

const ROUTES: Record<string, (req: ApiRequest, res: ApiResponse) => Promise<void>> = {
  access: handleAccess,
  'admin-login': handleAdminLogin,
  logout: handleLogout,
  me: handleMe,
  'admin-access-info': handleAdminAccessInfo,
  'admin-set-access-code': handleAdminSetAccessCode
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = typeof req.params.action === 'string' ? req.params.action : '';
  const route = ROUTES[action];
  if (!route) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await route(req, res);
}
