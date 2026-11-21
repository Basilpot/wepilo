type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

/**
 * The marketing site is static. This Worker only adds the headers a marketing site needs:
 * long caching for fingerprinted assets, and short caching for the HTML.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    const isAsset = url.pathname.startsWith("/_astro/") || /\.(svg|png|jpg|jpeg|webp|avif|ico|woff2?)$/.test(url.pathname);

    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://wepiloapi.basilpot.com; frame-ancestors 'none'; base-uri 'self'",
    );

    if (isAsset && response.status === 200) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (response.status === 200) {
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
