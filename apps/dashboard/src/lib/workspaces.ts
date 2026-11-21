/** Which workspace the person used last, so signing in opens it again. */
const LAST_WORKSPACE_KEY = "wepilo-last-workspace";

export function rememberWorkspace(id: number | undefined) {
  try {
    if (id) localStorage.setItem(LAST_WORKSPACE_KEY, String(id));
    else localStorage.removeItem(LAST_WORKSPACE_KEY);
  } catch {
    /* storage blocked */
  }
}

export function lastWorkspace(): number | undefined {
  try {
    const raw = localStorage.getItem(LAST_WORKSPACE_KEY);
    const id = Number(raw);
    return raw && Number.isInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

/** "Acme Expeditions" → "acme-expeditions". */
export function slugFromName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
