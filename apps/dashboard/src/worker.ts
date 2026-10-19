type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

const API_ORIGIN = "nerfuapi.basilpot.com";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const upstream = new URL(request.url);
      upstream.host = API_ORIGIN;
      return fetch(upstream, request);
    }
    return env.ASSETS.fetch(request);
  },
};
