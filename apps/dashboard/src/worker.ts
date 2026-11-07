type Env = { ASSETS: { fetch(request: Request): Promise<Response> }; STOREFRONT_URL?: string };

const API_ORIGIN = "wepiloapi.basilpot.com";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const upstream = new URL(request.url);
      upstream.host = API_ORIGIN;
      // A Worker-to-Worker subrequest reaches the API with a shared Cloudflare address, so
      // pass the real visitor along for rate limiting. The API only trusts this in that case.
      const forwarded = new Request(upstream, request);
      const visitor = request.headers.get("cf-connecting-ip");
      if (visitor) forwarded.headers.set("x-wepilo-client-ip", visitor);
      else forwarded.headers.delete("x-wepilo-client-ip");
      return fetch(forwarded);
    }
    // Deployment settings the browser needs, set in wrangler.jsonc rather than baked into the build.
    if (url.pathname === "/config.json") {
      return Response.json({ storefrontUrl: env.STOREFRONT_URL ?? null }, { headers: { "cache-control": "no-store" } });
    }
    return env.ASSETS.fetch(request);
  },
};
