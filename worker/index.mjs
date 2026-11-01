import { handleAuth } from "./auth.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleAuth(request, env);
    return env.ASSETS.fetch(request);
  }
};
