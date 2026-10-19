import type { Env } from "@/env";

export type StoredObject = {
  key: string;
  url: string;
  size: number;
  contentType: string;
};

function publicUrl(env: Env, key: string) {
  return `${env.API_BASE_URL}/media/file/${key}`;
}

export async function putObject(
  env: Env,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string,
): Promise<StoredObject> {
  const result = await env.MEDIA.put(key, body, { httpMetadata: { contentType } });
  return {
    key,
    url: publicUrl(env, key),
    size: result?.size ?? 0,
    contentType,
  };
}

export async function getObject(env: Env, key: string) {
  return env.MEDIA.get(key);
}

export async function deleteObject(env: Env, key: string) {
  await env.MEDIA.delete(key);
}

export function mediaKey(tenantId: number, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const suffix = crypto.randomUUID().slice(0, 8);
  return `tenants/${tenantId}/${Date.now()}-${suffix}-${safe}`;
}
