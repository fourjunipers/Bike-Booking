/**
 * The marketplace admin's catalog queue (re-check follow-up 2, 12 Nov 2026):
 * only requests from marketplace shops. A platform shop's request is decided
 * in the platform's admin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { catalogRequestQueue } from "@/lib/admin-queue";
import { seed, serviceClient } from "./helpers";

const service = serviceClient();
const tag = Math.random().toString(36).slice(2, 8);
let fromMarketplaceShop: string;
let fromPlatformShop: string;
let tenantId: string;

const entry = (model: string, extra: object) => ({
  make: "Queuemake",
  model: `${model} ${tag}`,
  type: "city_scooter" as const,
  transmission: "automatic" as const,
  cc: 125,
  status: "requested" as const,
  ...extra,
});

beforeAll(async () => {
  const { data: tenant, error: tenantError } = await service
    .schema("platform")
    .rpc("create_tenant", {
      p_name: `Queue ${tag}`,
      p_slug: `queue-${tag}`,
      p_country: "VN",
      p_currency: "VND",
      p_locale: "vi-VN",
      p_timezone: "Asia/Ho_Chi_Minh",
    });
  if (tenantError) throw tenantError;
  tenantId = tenant;

  const { data, error } = await service
    .from("bike_catalog")
    .insert([
      entry("Marketplace", { requested_by_shop_id: seed.draftShop }),
      entry("Platform", { requested_by_tenant_id: tenantId }),
    ])
    .select("id, requested_by_shop_id");
  if (error) throw error;
  fromMarketplaceShop = data.find((r) => r.requested_by_shop_id)!.id;
  fromPlatformShop = data.find((r) => !r.requested_by_shop_id)!.id;
});

afterAll(async () => {
  await service
    .from("bike_catalog")
    .delete()
    .in("id", [fromMarketplaceShop, fromPlatformShop]);
  await service.schema("platform").from("tenants").delete().eq("id", tenantId);
});

describe("marketplace admin: catalog requests", () => {
  it("lists a marketplace shop's request, with the shop's name", async () => {
    const { data, error } = await catalogRequestQueue(service);
    expect(error).toBeNull();
    const row = data!.find((r) => r.id === fromMarketplaceShop);
    expect(row).toBeDefined();
    expect(row!.shop?.name).toBeTruthy();
  });

  it("leaves out a platform shop's request", async () => {
    const { data } = await catalogRequestQueue(service);
    expect(data!.map((r) => r.id)).not.toContain(fromPlatformShop);
    // It is still a waiting request; it just isn't this queue's.
    const { data: row } = await service
      .from("bike_catalog")
      .select("status")
      .eq("id", fromPlatformShop)
      .single();
    expect(row!.status).toBe("requested");
  });

  it("every request it lists has a marketplace shop", async () => {
    const { data } = await catalogRequestQueue(service);
    expect(data!.every((r) => r.shop !== null)).toBe(true);
  });
});
