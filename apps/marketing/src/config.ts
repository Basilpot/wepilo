/** One place for every address the marketing site points at. Change the domain here. */
export const SITE_URL = "https://wepilo.com";
export const APP_URL = "https://wepilo.basilpot.com";
export const CONTACT_EMAIL = "hello@wepilo.com";

export const SIGNUP_URL = `${APP_URL}/signup`;
export const LOGIN_URL = `${APP_URL}/login`;
/** The free setup call that comes with every paid plan. */
export const SETUP_CALL_URL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Wepilo setup call")}`;
