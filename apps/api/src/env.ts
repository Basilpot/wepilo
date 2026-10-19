export type Env = {
  DB: D1Database;
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
