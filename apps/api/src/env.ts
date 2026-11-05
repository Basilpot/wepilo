import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export type Env = {
  DB: D1Database;
  /** OAuth grants, tokens and clients for the AI connector, plus pending connect requests. */
  OAUTH_KV: KVNamespace;
  /** Injected by the OAuth provider wrapper (src/index.ts) on every request it forwards. */
  OAUTH_PROVIDER?: OAuthHelpers;
  MEDIA: R2Bucket;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  DODO_API_KEY: string;
  DODO_WEBHOOK_SECRET: string;
  /** "test_mode" or "live_mode" */
  DODO_ENVIRONMENT: string;
  /** One-time $1 product that unlocks the 3-day trial */
  DODO_TRIAL_PRODUCT_ID: string;
  DODO_STARTER_MONTHLY_PRODUCT_ID?: string;
  DODO_STARTER_ANNUAL_PRODUCT_ID?: string;
  DODO_GROWTH_MONTHLY_PRODUCT_ID?: string;
  DODO_GROWTH_ANNUAL_PRODUCT_ID?: string;
  DODO_SCALE_MONTHLY_PRODUCT_ID?: string;
  DODO_SCALE_ANNUAL_PRODUCT_ID?: string;
  ENVIRONMENT: string;
  COOKIE_DOMAIN: string;
  API_BASE_URL: string;
  DASHBOARD_URL: string;
  SITE_URL: string;
  PLATFORM_EMAIL_FROM: string;
  PLATFORM_SUPPORT_EMAIL: string;
};
