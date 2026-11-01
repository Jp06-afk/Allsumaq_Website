import {
  verifyGoogleIdToken,
  signToken,
  readToken,
  handleAuth,
  toBase64Url,
} from "/worker/auth.mjs";
import worker from "/worker/index.mjs";

export async function runAuthChecks() {
  // Cloudflare permite leer y escribir Set-Cookie en sus Response. El navegador
  // filtra esa cabecera; se reproduce aquí el comportamiento de Headers del edge.
  const BrowserResponse = globalThis.Response;
  globalThis.Response = class extends BrowserResponse {
    constructor(body, init = {}) {
      super(body, init);
      Object.defineProperty(this, "headers", {
        value: new Headers(init.headers || {}),
      });
    }
  };
  try {
    return await runCoreChecks();
  } finally {
    globalThis.Response = BrowserResponse;
  }
}

async function runCoreChecks() {
  const checks = [];
  // En el navegador, Request elimina Origin al construir cabeceras protegidas.
  // Este objeto representa el Request que recibe realmente Cloudflare.
  function request(url, init = {}) {
    return {
      url,
      method: init.method || "GET",
      headers: new Headers(init.headers || {}),
      text: async () => String(init.body || ""),
    };
  }
  function check(value, label) {
    if (!value) throw new Error(label);
    checks.push(label);
  }
  async function rejects(action, code, label) {
    try {
      await action();
    } catch (error) {
      check(error.code === code, label);
      return;
    }
    throw new Error(label);
  }
  const secret = "test-only-session-secret-never-use-in-production-123456789";
  const origin = "https://allsumaq-website.jpfj-06.workers.dev";
  const clientId = "1234567890-test.apps.googleusercontent.com";
  const env = {
    GOOGLE_CLIENT_ID: clientId,
    SESSION_SECRET: secret,
    PUBLIC_ORIGIN: origin,
  };
  const now = Math.floor(Date.now() / 1000);
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "test-rsa-key",
    use: "sig",
  };
  const base = {
    iss: "https://accounts.google.com",
    aud: clientId,
    sub: "123456789012345",
    email: "prueba@example.com",
    email_verified: true,
    name: "Usuario de prueba",
    iat: now,
    exp: now + 3600,
    nonce: "test-nonce-with-more-than-twenty-characters",
  };
  async function token(
    payload = base,
    header = { alg: "RS256", kid: jwk.kid },
  ) {
    const encoder = new TextEncoder();
    const content =
      toBase64Url(encoder.encode(JSON.stringify(header))) +
      "." +
      toBase64Url(encoder.encode(JSON.stringify(payload)));
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      pair.privateKey,
      encoder.encode(content),
    );
    return content + "." + toBase64Url(signature);
  }
  const validToken = await token();
  const options = { keys: [jwk] };
  const user = await verifyGoogleIdToken(
    validToken,
    clientId,
    base.nonce,
    options,
  );
  check(
    user.sub === base.sub && user.email === base.email,
    "Google: firma RSA válida y cuenta verificada",
  );
  await rejects(
    () =>
      verifyGoogleIdToken(validToken, "another-client", base.nonce, options),
    "INVALID_TOKEN",
    "Google: audiencia de otra aplicación rechazada",
  );
  await rejects(
    async () =>
      verifyGoogleIdToken(
        await token({ ...base, iss: "https://attacker.example" }),
        clientId,
        base.nonce,
        options,
      ),
    "INVALID_TOKEN",
    "Google: emisor ajeno rechazado",
  );
  await rejects(
    async () =>
      verifyGoogleIdToken(
        await token({ ...base, exp: now - 1 }),
        clientId,
        base.nonce,
        options,
      ),
    "EXPIRED_TOKEN",
    "Google: credencial caducada rechazada",
  );
  await rejects(
    () =>
      verifyGoogleIdToken(
        validToken,
        clientId,
        "nonce-different-from-the-original",
        options,
      ),
    "INVALID_NONCE",
    "Google: nonce de otra sesión rechazado",
  );
  await rejects(
    async () =>
      verifyGoogleIdToken(
        await token({ ...base, email_verified: false }),
        clientId,
        base.nonce,
        options,
      ),
    "INVALID_ACCOUNT",
    "Google: correo sin verificar rechazado",
  );
  const parts = validToken.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  await rejects(
    () => verifyGoogleIdToken(parts.join("."), clientId, base.nonce, options),
    "INVALID_SIGNATURE",
    "Google: firma alterada rechazada",
  );
  await rejects(
    async () =>
      verifyGoogleIdToken(
        await token(base, { alg: "none", kid: jwk.kid }),
        clientId,
        base.nonce,
        options,
      ),
    "INVALID_TOKEN",
    "Google: algoritmo no autorizado rechazado",
  );
  const session = await signToken(
    { purpose: "session", user, exp: now + 60 },
    secret,
  );
  check(
    (await readToken(session, secret, "session"))?.user.sub === user.sub,
    "Sesión: cookie firmada válida",
  );
  check(
    (await readToken(session, secret + "-wrong", "session")) === null,
    "Sesión: firma incorrecta rechazada",
  );
  check(
    (await readToken(session, secret, "challenge")) === null,
    "Sesión: propósito distinto rechazado",
  );
  check(
    (await readToken(
      await signToken({ purpose: "session", user, exp: now - 1 }, secret),
      secret,
      "session",
    )) === null,
    "Sesión: expiración respetada",
  );
  const config = await handleAuth(request(origin + "/api/auth/config"), env);
  const configText = await config.text();
  check(
    configText.includes(clientId) && !configText.includes(secret),
    "Configuración pública no revela el secreto de sesión",
  );
  const unconfigured = await handleAuth(
    request(origin + "/api/auth/challenge", {
      method: "POST",
      headers: { Origin: origin },
    }),
    {},
  );
  check(
    unconfigured.status === 503,
    "Google: configuración ausente produce estado explícito",
  );
  const wrongOrigin = await handleAuth(
    request(origin + "/api/auth/challenge", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
    }),
    env,
  );
  check(wrongOrigin.status === 403, "Acceso: origen externo bloqueado");
  const challengeResponse = await handleAuth(
    request(origin + "/api/auth/challenge", {
      method: "POST",
      headers: { Origin: origin },
    }),
    env,
  );
  const challengeCookie = challengeResponse.headers.get("set-cookie");
  const challenge = await challengeResponse.json();
  check(
    challengeCookie.includes("HttpOnly") &&
      challengeCookie.includes("Secure") &&
      challengeCookie.includes("SameSite=Lax"),
    "Desafío: cookie HttpOnly, Secure y SameSite",
  );
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) =>
      String(input) === "https://www.googleapis.com/oauth2/v3/certs"
        ? new Response(JSON.stringify({ keys: [jwk] }), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "max-age=3600",
            },
          })
        : originalFetch(input, init);
    const credential = await token({ ...base, nonce: challenge.nonce });
    const login = await handleAuth(
      request(origin + "/api/auth/google", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: challengeCookie.split(";")[0],
        },
        body: JSON.stringify({ credential }),
      }),
      env,
    );
    check(
      login.status === 200 && (await login.json()).authenticated,
      "Acceso: validación criptográfica seguida de sesión autenticada",
    );
    const sessionCookie = login.headers.get("set-cookie");
    const restored = await handleAuth(
      request(origin + "/api/auth/session", {
        headers: { Cookie: sessionCookie.split(";")[0] },
      }),
      env,
    );
    check(
      (await restored.json()).user.sub === user.sub,
      "Acceso: sesión recuperable desde cookie firmada",
    );
    const missingChallenge = await handleAuth(
      request(origin + "/api/auth/google", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      }),
      env,
    );
    check(
      missingChallenge.status === 401,
      "Acceso: credencial sin desafío de navegador rechazada",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  const logout = await handleAuth(
    request(origin + "/api/auth/logout", {
      method: "POST",
      headers: { Origin: origin },
    }),
    env,
  );
  check(
    logout.headers.get("set-cookie").includes("Max-Age=0"),
    "Cerrar sesión elimina la cookie",
  );
  const apiNotFound = await worker.fetch(request(origin + "/api/no-existe"), {
    ...env,
    ASSETS: {
      fetch() {
        throw new Error("No debe servir HTML para una API");
      },
    },
  });
  check(
    apiNotFound.status === 404,
    "Worker: las API inexistentes no reciben HTML estático",
  );
  const asset = await worker.fetch(request(origin + "/index.html"), {
    ...env,
    ASSETS: {
      fetch() {
        return new Response("static-ok");
      },
    },
  });
  check(
    (await asset.text()) === "static-ok",
    "Worker: conserva el servicio de archivos estáticos",
  );
  return checks;
}
