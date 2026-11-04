import { describe, expect, it } from "vitest";
import {
  BIKE_PLACEHOLDER,
  fitWithin,
  isOwnPhotoPath,
  photoUrl,
} from "./photos";

const shopId = "b0000000-0000-4000-8000-000000000001";
const modelId = "c0000000-0000-4000-8000-000000000002";

describe("photoUrl", () => {
  it("builds public Storage URLs", () => {
    expect(
      photoUrl(
        "http://127.0.0.1:54321/",
        "model-photos",
        `${shopId}/${modelId}/a b.webp`,
      ),
    ).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/model-photos/${shopId}/${modelId}/a%20b.webp`,
    );
  });

  it("passes /public paths through and falls back when empty", () => {
    expect(photoUrl("http://x", "shop-photos", "/images/a.svg")).toBe(
      "/images/a.svg",
    );
    expect(photoUrl("http://x", "model-photos", null)).toBe(BIKE_PLACEHOLDER);
  });
});

describe("isOwnPhotoPath", () => {
  it("accepts the shop's own folder", () => {
    expect(isOwnPhotoPath(`${shopId}/x.webp`, shopId)).toBe(true);
    expect(isOwnPhotoPath(`${shopId}/${modelId}/x.webp`, shopId, modelId)).toBe(
      true,
    );
    expect(
      isOwnPhotoPath("/images/placeholder-bike.svg", shopId, modelId),
    ).toBe(true);
  });

  it("rejects other folders and traversal", () => {
    expect(isOwnPhotoPath(`other/x.webp`, shopId)).toBe(false);
    expect(isOwnPhotoPath(`${shopId}/../x.webp`, shopId)).toBe(false);
    expect(isOwnPhotoPath(`${shopId}/x.webp`, shopId, modelId)).toBe(false);
    expect(isOwnPhotoPath(`${shopId}/other/x.webp`, shopId, modelId)).toBe(
      false,
    );
  });
});

describe("fitWithin", () => {
  it("keeps small images and scales large ones by the longest edge", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
});
