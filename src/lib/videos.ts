import { put, list } from "@vercel/blob";
import { nanoid } from "nanoid";
import { mkdir, writeFile, readFile, access, readdir } from "fs/promises";
import path from "path";

export type VideoMeta = {
  id: string;
  url: string;
  contentType: string;
  createdAt: string;
  filename: string;
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/** Read dynamically so Next.js does not bake undefined at build time. */
function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function blobDiagnostics() {
  return {
    vercel: Boolean(env("VERCEL")),
    hasReadWriteToken: Boolean(env("BLOB_READ_WRITE_TOKEN")),
    hasStoreId: Boolean(env("BLOB_STORE_ID")),
    hasOidcToken: Boolean(env("VERCEL_OIDC_TOKEN")),
    hasWebhookKey: Boolean(env("BLOB_WEBHOOK_PUBLIC_KEY")),
  };
}

function canUseBlob(): boolean {
  // Modern Vercel Blob uses OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN).
  // Older setups use BLOB_READ_WRITE_TOKEN. On Vercel, always prefer Blob.
  return Boolean(
    env("BLOB_READ_WRITE_TOKEN") ||
      env("BLOB_STORE_ID") ||
      env("VERCEL")
  );
}

function assertLocalStorageAllowed() {
  if (env("VERCEL")) {
    throw new Error(
      "Vercel Blob auth was not available in this deployment. Redeploy without build cache, and confirm BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN are enabled for Production."
    );
  }
}

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function metaPath(id: string) {
  return path.join(UPLOAD_DIR, `${id}.json`);
}

function filePath(id: string, ext: string) {
  return path.join(UPLOAD_DIR, `${id}${ext}`);
}

function extFromType(contentType: string, filename: string) {
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("quicktime") || filename.endsWith(".mov")) return ".mov";
  return ".mp4";
}

export function createId() {
  return nanoid(8);
}

async function saveToBlob(
  id: string,
  bytes: Buffer,
  contentType: string,
  filename: string
): Promise<VideoMeta> {
  // Let the SDK pick auth automatically:
  // 1) OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN) on Vercel
  // 2) fallback BLOB_READ_WRITE_TOKEN
  const blob = await put(`videos/${id}${extFromType(contentType, filename)}`, bytes, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });

  const meta: VideoMeta = {
    id,
    url: blob.url,
    contentType,
    createdAt: new Date().toISOString(),
    filename,
  };

  await put(`meta/${id}.json`, JSON.stringify(meta), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return meta;
}

export async function saveVideo(id: string, file: File): Promise<VideoMeta> {
  const contentType = file.type || "video/mp4";
  const filename = file.name || `video${extFromType(contentType, "")}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (canUseBlob()) {
    try {
      return await saveToBlob(id, bytes, contentType, filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Blob upload failed";
      const diag = blobDiagnostics();
      throw new Error(
        `${message} | diag: vercel=${diag.vercel} token=${diag.hasReadWriteToken} storeId=${diag.hasStoreId} oidc=${diag.hasOidcToken}`
      );
    }
  }

  assertLocalStorageAllowed();

  await ensureUploadDir();
  const ext = extFromType(contentType, filename);
  await writeFile(filePath(id, ext), bytes);

  const meta: VideoMeta = {
    id,
    url: `/api/file/${id}`,
    contentType,
    createdAt: new Date().toISOString(),
    filename,
  };

  await writeFile(metaPath(id), JSON.stringify(meta, null, 2));
  return meta;
}

export async function getVideoMeta(id: string): Promise<VideoMeta | null> {
  if (canUseBlob()) {
    try {
      const { blobs } = await list({ prefix: `meta/${id}.json`, limit: 1 });
      const blob = blobs[0];
      if (!blob) return null;
      const res = await fetch(blob.url, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as VideoMeta;
    } catch {
      return null;
    }
  }

  try {
    await access(metaPath(id));
    const raw = await readFile(metaPath(id), "utf8");
    return JSON.parse(raw) as VideoMeta;
  } catch {
    return null;
  }
}

export async function listVideos(): Promise<VideoMeta[]> {
  if (canUseBlob()) {
    try {
      const { blobs } = await list({ prefix: "meta/", limit: 100 });
      const metas = await Promise.all(
        blobs.map(async (blob) => {
          try {
            const res = await fetch(blob.url, { cache: "no-store" });
            if (!res.ok) return null;
            return (await res.json()) as VideoMeta;
          } catch {
            return null;
          }
        })
      );
      return metas
        .filter((m): m is VideoMeta => Boolean(m?.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  try {
    assertLocalStorageAllowed();
    await ensureUploadDir();
    const files = await readdir(UPLOAD_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const metas = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const raw = await readFile(path.join(UPLOAD_DIR, file), "utf8");
          return JSON.parse(raw) as VideoMeta;
        } catch {
          return null;
        }
      })
    );
    return metas
      .filter((m): m is VideoMeta => Boolean(m?.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getLocalVideo(id: string): Promise<{
  data: Buffer;
  contentType: string;
} | null> {
  const meta = await getVideoMeta(id);
  if (!meta) return null;

  const candidates = [".mp4", ".webm", ".mov"];
  for (const ext of candidates) {
    try {
      const data = await readFile(filePath(id, ext));
      return { data, contentType: meta.contentType };
    } catch {
      // try next
    }
  }
  return null;
}
