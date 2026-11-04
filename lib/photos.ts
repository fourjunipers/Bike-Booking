/**
 * Photo paths. The database stores a path inside a public Storage bucket
 * ("<shop_id>/<file>.webp"). Paths starting with "/" are files in /public,
 * used by the seed and as placeholders.
 */

export const PHOTO_BUCKETS = {
  shop: "shop-photos",
  model: "model-photos",
  catalog: "catalog-photos",
} as const;

export type PhotoBucket = (typeof PHOTO_BUCKETS)[keyof typeof PHOTO_BUCKETS];

export const BIKE_PLACEHOLDER = "/images/placeholder-bike.svg";
export const SHOP_PLACEHOLDER = "/images/placeholder-shop.svg";

export const MAX_SHOP_PHOTOS = 12;
export const MAX_MODEL_PHOTOS = 8;

/** Longest edge after the in-browser resize, in pixels. */
export const PHOTO_MAX_EDGE = 1600;

export function photoUrl(
  supabaseUrl: string,
  bucket: PhotoBucket,
  path: string | null | undefined,
  fallback = BIKE_PLACEHOLDER,
): string {
  if (!path) return fallback;
  if (path.startsWith("/")) return path;
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

/**
 * True when `path` is a file this shop may reference: inside its own folder
 * (and the model's folder for model photos), or a /public placeholder.
 */
export function isOwnPhotoPath(
  path: string,
  shopId: string,
  modelId?: string,
): boolean {
  if (path.startsWith("/images/")) return !path.includes("..");
  const parts = path.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return false;
  if (modelId) {
    return parts.length === 3 && parts[0] === shopId && parts[1] === modelId;
  }
  return parts.length === 2 && parts[0] === shopId;
}

/** Resized dimensions keeping the aspect ratio, longest edge ≤ maxEdge. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = PHOTO_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
