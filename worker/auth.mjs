// Google Identity + Web Crypto. No dependencias ni contraseñas de Google.
const encoder = new TextEncoder();
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const SESSION_COOKIE = "allsumaq_session";
const CHALLENGE_COOKIE = "allsumaq_challenge";
let cachedKeys = null;

export class AuthError extends Error {
  constructor(code, status = 401) { super(code); this.code = code; this.status = status; }
}

export function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new AuthError("INVALID_TOKEN");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
}

function parsePart(value) {
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch (_) { throw new AuthError("INVALID_TOKEN"); }
}

async function hmacKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new AuthError("AUTH_NOT_CONFIGURED", 503);
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(data, secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify(data)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return payload + "." + toBase64Url(signature);
}

export async function readToken(value, secret, purpose, now = Date.now()) {
  if (typeof value !== "string" || value.length > 6000) return null;
  try {
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(parts[1]), encoder.encode(parts[0]));
    if (!valid) return null;
    const payload = parsePart(parts[0]);
    return payload.purpose === purpose && Number.isFinite(payload.exp) && payload.exp > now / 1000 ? payload : null;
  } catch (_) { return null; }
}

async function googleKeys(fetcher, force = false) {
  const now = Date.now();
  if (cachedKeys && ((!force && cachedKeys.expires > now) || now - cachedKeys.fetched < 60000)) return cachedKeys.keys;
  const response = await fetcher(JWKS_URL, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new AuthError("GOOGLE_UNAVAILABLE", 503);
  const data = await response.json();
  if (!Array.isArray(data.keys)) throw new AuthError("GOOGLE_UNAVAILABLE", 503);
  const maxAge = Number((response.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  cachedKeys = { keys: data.keys, fetched: now, expires: now + Math.min(maxAge, 86400) * 1000 };
  return cachedKeys.keys;
}

export async function verifyGoogleIdToken(token, clientId, expectedNonce, options = {}) {
  if (typeof token !== "string" || token.length > 16000) throw new AuthError("INVALID_TOKEN");
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("INVALID_TOKEN");
  const header = parsePart(parts[0]);
  const payload = parsePart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new AuthError("INVALID_TOKEN");
  const now = (options.now ?? Date.now()) / 1000;
  if (payload.aud !== clientId || !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) throw new AuthError("INVALID_TOKEN");
  if (!Number.isFinite(payload.exp) || payload.exp <= now || !Number.isFinite(payload.iat) || payload.iat > now + 120) throw new AuthError("EXPIRED_TOKEN");
  if (typeof expectedNonce !== "string" || expectedNonce.length < 20 || payload.nonce !== expectedNonce) throw new AuthError("INVALID_NONCE");
  if (typeof payload.sub !== "string" || !/^\d{1,255}$/.test(payload.sub) || payload.email_verified !== true || typeof payload.email !== "string" || payload.email.length > 254) throw new AuthError("INVALID_ACCOUNT");
  let keys = options.keys || await googleKeys(options.fetcher || fetch);
  let jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA" && key.use === "sig");
  if (!jwk && !options.keys) {
    keys = await googleKeys(options.fetcher || fetch, true);
    jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA" && key.use === "sig");
  }
  if (!jwk) throw new AuthError("INVALID_SIGNATURE");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromBase64Url(parts[2]), encoder.encode(parts[0] + "." + parts[1]));
  if (!valid) throw new AuthError("INVALID_SIGNATURE");
  return { sub: payload.sub, nombre: String(payload.name || "Estudiante Allsumaq").slice(0, 100), email: payload.email };
}

function cookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
}

function cookie(name, value, seconds, request) {
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}

function configured(env) {
  return typeof env.GOOGLE_CLIENT_ID === "string" && /^[\w.-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID) && typeof env.SESSION_SECRET === "string" && env.SESSION_SECRET.length >= 32;
}

function checkOrigin(request, env) {
  const actual = new URL(request.url).origin;
  const allowed = env.PUBLIC_ORIGIN || actual;
  if (actual !== allowed || request.headers.get("Origin") !== actual) throw new AuthError("INVALID_ORIGIN", 403);
}

export async function handleAuth(request, env) {
  const path = new URL(request.url).pathname;
  try {
    if (path === "/api/auth/config" && request.method === "GET") {
      return json({ configured: configured(env), googleClientId: configured(env) ? env.GOOGLE_CLIENT_ID : null });
    }
    if (path === "/api/auth/session" && request.method === "GET") {
      if (!configured(env)) return json({ authenticated: false });
      const data = await readToken(cookies(request)[SESSION_COOKIE], env.SESSION_SECRET, "session");
      return json(data ? { authenticated: true, user: data.user } : { authenticated: false });
    }
    if (path === "/api/auth/challenge" && request.method === "POST") {
      checkOrigin(request, env);
      if (!configured(env)) throw new AuthError("AUTH_NOT_CONFIGURED", 503);
      const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const signed = await signToken({ purpose: "challenge", nonce, exp: Math.floor(Date.now() / 1000) + 600 }, env.SESSION_SECRET);
      return json({ nonce }, 200, { "Set-Cookie": cookie(CHALLENGE_COOKIE, signed, 600, request) });
    }
    if (path === "/api/auth/google" && request.method === "POST") {
      checkOrigin(request, env);
      if (!configured(env)) throw new AuthError("AUTH_NOT_CONFIGURED", 503);
      if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) throw new AuthError("INVALID_REQUEST", 400);
      const raw = await request.text();
      if (raw.length > 18000) throw new AuthError("INVALID_REQUEST", 413);
      let body;
      try { body = JSON.parse(raw); } catch (_) { throw new AuthError("INVALID_REQUEST", 400); }
      const challenge = await readToken(cookies(request)[CHALLENGE_COOKIE], env.SESSION_SECRET, "challenge");
      if (!challenge) throw new AuthError("EXPIRED_CHALLENGE");
      const user = await verifyGoogleIdToken(body?.credential, env.GOOGLE_CLIENT_ID, challenge.nonce);
      const duration = 86400;
      const session = await signToken({ purpose: "session", user, exp: Math.floor(Date.now() / 1000) + duration }, env.SESSION_SECRET);
      const response = json({ authenticated: true, user });
      response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, session, duration, request));
      response.headers.append("Set-Cookie", cookie(CHALLENGE_COOKIE, "", 0, request));
      return response;
    }
    if (path === "/api/auth/logout" && request.method === "POST") {
      checkOrigin(request, env);
      const response = json({ authenticated: false });
      response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0, request));
      response.headers.append("Set-Cookie", cookie(CHALLENGE_COOKIE, "", 0, request));
      return response;
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    if (error instanceof AuthError) return json({ error: error.code }, error.status);
    return json({ error: "AUTH_UNAVAILABLE" }, 503);
  }
}
