import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authorizationPath } from '../auth/request-path.js';

export function trustedOrigin(origin: string | undefined, frontendUrl: string): boolean {
  try {
    const frontend = new URL(frontendUrl);
    const supplied = new URL(origin || '');
    return ['http:', 'https:'].includes(frontend.protocol)
      && origin === supplied.origin && supplied.origin === frontend.origin;
  } catch { return false; }
}

const isAuthSensitiveRequest = (method: string, rawPath: string): boolean => {
  const path = authorizationPath(rawPath);
  if (method === 'POST' && ['/user/login', '/user/forgotpassword'].includes(path)) return true;
  if (method === 'PATCH' && (
    path === '/user/updatepassword'
    || path === '/accounts/me/password'
    || path.startsWith('/user/resetpassword/')
  )) return true;
  return false;
};

/** Install before body parsing, sessions and all database-backed middleware. */
export function requestSecurity(frontendUrl: string, generalLimit = 1500): RequestHandler[] {
  const options = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-7' as const, legacyHeaders: false };
  return [
    rateLimit({ ...options, limit: generalLimit }),
    rateLimit({ ...options, limit: 20, skip: request => !isAuthSensitiveRequest(request.method, request.path) }),
    rateLimit({ ...options, limit: 30, skip: request => !(
      request.method === 'POST' && authorizationPath(request.path) === '/user/submit'
      || request.method === 'PATCH' && authorizationPath(request.path) === '/user/uploadpp') }),
    (request, response, next) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)
        || trustedOrigin(request.get('origin'), frontendUrl)) return next();
      response.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
    },
  ];
}
