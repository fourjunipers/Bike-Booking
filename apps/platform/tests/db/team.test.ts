/** Team and shop settings rules, enforced by the database (SPEC › Team, settings and platform). */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  deleteTenant,
  serviceClient,
  type TestTenant,
} from "./helpers";

let t: TestTenant;

beforeAll(async () => {
  t = await createTenant("team");
});

afterAll(async () => {
  await deleteTenant(t);
});

/** Puts every member back in their original role between tests. */
beforeEach(async () => {
  const service = serviceClient();
  for (const [role, member] of Object.entries(t.members)) {
    await service
      .from("memberships")
      .upsert(
        {
          id: member.membershipId,
          tenant_id: t.id,
          user_id: member.id,
          role: role as keyof TestTenant["members"],
        },
        { onConflict: "id" },
      );
  }
});

async function roleOf(membershipId: string) {
  const { data } = await serviceClient()
    .from("memberships")
    .select("role")
    .eq("id", membershipId)
    .maybeSingle();
  return data?.role ?? null;
}

describe("team list", () => {
  it("shows every member's role, name and email to any member", async () => {
    const { data, error } = await t.members.driver.db.rpc("tenant_members", {
      p_tenant_id: t.id,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(5);
    const owner = data!.find((m) => m.role === "owner")!;
    expect(owner.email).toBe(t.members.owner.email);
    expect(owner.name).toBe("Test team-owner");
  });
});

describe("owners", () => {
  it("can promote staff to manager and owner", async () => {
    const db = t.members.owner.db;
    const target = t.members.staff.membershipId;
    expect((await db.rpc("set_member_role", { p_membership_id: target, p_role: "manager" })).error).toBeNull();
    expect(await roleOf(target)).toBe("manager");
    expect((await db.rpc("set_member_role", { p_membership_id: target, p_role: "owner" })).error).toBeNull();
    expect(await roleOf(target)).toBe("owner");
  });

  it("can remove a member", async () => {
    const target = t.members.driver.membershipId;
    const { error } = await t.members.owner.db.rpc("remove_member", {
      p_membership_id: target,
    });
    expect(error).toBeNull();
    expect(await roleOf(target)).toBeNull();
  });

  it("can't leave the shop without an owner", async () => {
    const db = t.members.owner.db;
    const self = t.members.owner.membershipId;
    const demote = await db.rpc("set_member_role", { p_membership_id: self, p_role: "manager" });
    expect(demote.error?.message).toBe("A shop needs at least one owner");
    const remove = await db.rpc("remove_member", { p_membership_id: self });
    expect(remove.error?.message).toBe("A shop needs at least one owner");
    expect(await roleOf(self)).toBe("owner");
  });

  it("can step down once there's another owner", async () => {
    const db = t.members.owner.db;
    await db.rpc("set_member_role", { p_membership_id: t.members.manager.membershipId, p_role: "owner" });
    const { error } = await db.rpc("set_member_role", {
      p_membership_id: t.members.owner.membershipId,
      p_role: "manager",
    });
    expect(error).toBeNull();
  });
});

describe("managers", () => {
  it("can move staff, mechanics and drivers between those roles", async () => {
    const target = t.members.staff.membershipId;
    const { error } = await t.members.manager.db.rpc("set_member_role", {
      p_membership_id: target,
      p_role: "mechanic",
    });
    expect(error).toBeNull();
    expect(await roleOf(target)).toBe("mechanic");
  });

  it("can't grant manager or owner, or touch an owner", async () => {
    const db = t.members.manager.db;
    for (const [target, role] of [
      [t.members.staff.membershipId, "manager"],
      [t.members.staff.membershipId, "owner"],
      [t.members.owner.membershipId, "staff"],
    ] as const) {
      const { error } = await db.rpc("set_member_role", { p_membership_id: target, p_role: role });
      expect(error?.code).toBe("42501");
    }
    const remove = await db.rpc("remove_member", { p_membership_id: t.members.owner.membershipId });
    expect(remove.error?.code).toBe("42501");
  });

  it("can edit shop settings", async () => {
    const { data, error } = await t.members.manager.db
      .from("tenants")
      .update({ name: "Renamed by manager", timezone: "Europe/Berlin" })
      .eq("id", t.id)
      .select("name, timezone");
    expect(error).toBeNull();
    expect(data).toEqual([{ name: "Renamed by manager", timezone: "Europe/Berlin" }]);
  });
});

describe("staff, mechanics and drivers", () => {
  it("can't change the team", async () => {
    for (const actor of ["staff", "mechanic", "driver"] as const) {
      const { error } = await t.members[actor].db.rpc("set_member_role", {
        p_membership_id: t.members.driver.membershipId,
        p_role: "staff",
      });
      expect(error?.code, actor).toBe("42501");
    }
  });

  it("can't edit shop settings", async () => {
    for (const actor of ["staff", "mechanic", "driver"] as const) {
      const { data } = await t.members[actor].db
        .from("tenants")
        .update({ name: `Renamed by ${actor}` })
        .eq("id", t.id)
        .select("id");
      expect(data, actor).toEqual([]);
    }
  });
});

describe("tenant rows", () => {
  it("can't be changed outside the settings columns", async () => {
    const { error } = await t.members.owner.db
      .from("tenants")
      .update({ slug: "new-slug" })
      .eq("id", t.id);
    expect(error?.code).toBe("42501");
  });

  it("reject unknown time zones and malformed codes", async () => {
    const service = serviceClient();
    const zone = await service.from("tenants").update({ timezone: "Mars/Olympus" }).eq("id", t.id);
    expect(zone.error?.message).toBe("Unknown time zone: Mars/Olympus");
    const currency = await service.from("tenants").update({ currency: "baht" }).eq("id", t.id);
    expect(currency.error?.code).toBe("23514");
  });
});
