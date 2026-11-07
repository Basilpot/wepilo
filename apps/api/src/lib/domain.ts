import type { Env } from "@/env";

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** "https://www.Agency.com/path" → "www.agency.com". Null when it isn't a plain public hostname. */
export function normalizeDomain(input: string): string | null {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (host.length < 4 || host.length > 253) return null;
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  if (/^\d+$/.test(labels[labels.length - 1])) return null; // an IP address
  if (labels[labels.length - 1].length < 2) return null;
  return host;
}

/** Hosts that belong to Wepilo itself can never be claimed by an agency. */
export function isPlatformHost(env: Pick<Env, "DASHBOARD_URL" | "API_BASE_URL" | "SITE_URL">, host: string) {
  for (const url of [env.DASHBOARD_URL, env.API_BASE_URL, env.SITE_URL]) {
    try {
      const own = new URL(url).hostname;
      if (host === own || host.endsWith(`.${own}`)) return true;
    } catch {
      /* ignore malformed config */
    }
  }
  return host === "localhost" || host.endsWith(".localhost");
}

export const verificationRecord = (domain: string) => `_wepilo-verify.${domain}`;
export const verificationValue = (token: string) => `wepilo-verify=${token}`;

/** Looks up TXT records over DNS-over-HTTPS (Cloudflare). Returns the record values, unquoted. */
export async function lookupTxt(name: string): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { Accept: "application/dns-json" },
  });
  if (!res.ok) throw new Error(`DNS lookup answered ${res.status}`);
  const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
  return (json.Answer ?? [])
    .filter((a) => a.type === 16)
    .map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
}
