import { describe, expect, it } from "vitest";
import {
  editDistance,
  exactPresets,
  normName,
  sameMakeModel,
  suggestCatalog,
} from "./catalog-match";
import { buildBoard, placeItem } from "./dashboard";
import {
  isIsoDate,
  isRentable,
  needsEngineSize,
  needsTransmission,
  ownModelSchema,
  parseModelChoice,
  renewalSchema,
  unitSchema,
  unitStatuses,
  vehicleTypes,
  yearBandSchema,
} from "./fleet";
import {
  currentRenewals,
  daysUntil,
  reminderSettingsSchema,
  renewalState,
  renewalsToShow,
  type Renewal,
} from "./renewals";

describe("bike form rules", () => {
  const unit = {
    location_id: "7c1f9a5e-1d2b-4c3d-8e4f-5a6b7c8d9e0f",
    plate: "",
    plate_pending: "",
    frame_number: "",
    engine_number: "",
    colour: "",
    model_year: "",
    notes: "",
  };

  it("a bike needs a plate or the plate-pending flag", () => {
    expect(
      unitSchema.safeParse(unit).error?.issues.map((i) => i.message),
    ).toEqual(["plateOrPending"]);
    expect(
      unitSchema.parse({ ...unit, plate_pending: "on" }).plate_pending,
    ).toBe(true);
    // Any country's plate, and a plate clears the pending flag.
    expect(
      unitSchema.parse({ ...unit, plate: " 1กข-1234 ", plate_pending: "on" }),
    ).toMatchObject({ plate: "1กข-1234", plate_pending: false });
  });

  it("a model year is a year, or blank", () => {
    expect(unitSchema.parse({ ...unit, plate: "A1" }).model_year).toBeNull();
    expect(
      unitSchema.parse({ ...unit, plate: "A1", model_year: "2024" }).model_year,
    ).toBe(2024);
    for (const bad of ["24", "1900", "2024.5", "new"])
      expect(
        unitSchema
          .safeParse({ ...unit, plate: "A1", model_year: bad })
          .error?.issues.map((i) => i.message),
        bad,
      ).toEqual(["invalidYear"]);
  });

  it("no longer has first-registered, borrowed dates or a status field", () => {
    for (const gone of [
      "first_registered",
      "active_from",
      "active_to",
      "status",
    ])
      expect(
        unitSchema.safeParse({ ...unit, plate: "A1", [gone]: "2026-01-01" })
          .success,
        gone,
      ).toBe(false);
    expect(unitStatuses).toEqual(["active", "maintenance", "retired", "sold"]);
    expect(unitStatuses.filter(isRentable)).toEqual(["active"]);
  });

  it("a vehicle goes on one of the shop's own makes & models, never straight on a list entry", () => {
    const id = "0b0e3b52-6f0e-4f3a-9a52-2a1c4f3f9d11";
    expect(parseModelChoice(`model:${id}`)).toEqual({ id });
    // "+ Add to inventory" never creates a make & model (12 Nov 2026).
    expect(parseModelChoice(`catalog:${id}`)).toBeNull();
    expect(parseModelChoice(id)).toBeNull();
    expect(parseModelChoice("")).toBeNull();
  });

  it("year bands and renewals must end after they start", () => {
    expect(
      yearBandSchema.parse({ year_from: "2020", year_to: "2023" }),
    ).toEqual({
      year_from: 2020,
      year_to: 2023,
    });
    expect(
      yearBandSchema.safeParse({ year_from: "2024", year_to: "2020" }).success,
    ).toBe(false);
    const renewal = {
      kind: "road_tax",
      provider: "",
      reference_no: "",
      starts_at: "2026-01-01",
      expires_at: "2026-12-31",
    };
    expect(renewalSchema.parse(renewal)).toMatchObject({ provider: null });
    expect(
      renewalSchema
        .safeParse({ ...renewal, expires_at: "2025-12-31" })
        .error?.issues.map((i) => i.message),
    ).toEqual(["endBeforeStart"]);
    expect(renewalSchema.safeParse({ ...renewal, kind: "mot" }).success).toBe(
      false,
    );
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
  });
});

describe("the shop's own models and the presets", () => {
  const presets = [
    {
      id: "pcx26",
      make: "Honda",
      model: "PCX 160",
      year_from: 2026,
      year_to: 2026,
    },
    {
      id: "pcx21",
      make: "Honda",
      model: "PCX 160",
      year_from: 2021,
      year_to: 2025,
    },
    {
      id: "click",
      make: "Honda",
      model: "Click 160",
      year_from: 2023,
      year_to: 2025,
    },
    {
      id: "adv",
      make: "Honda",
      model: "ADV 160",
      year_from: 2026,
      year_to: 2026,
    },
    {
      id: "nmax",
      make: "Yamaha",
      model: "NMAX",
      year_from: 2026,
      year_to: 2026,
    },
    {
      id: "forza",
      make: "Honda",
      model: "Forza 350",
      year_from: null,
      year_to: null,
    },
  ];
  const ids = (make: string, model: string) =>
    suggestCatalog(make, model, presets).map((p) => p.id);

  it("own models: vehicle type always; engine size and transmission for motorbikes", () => {
    const base = {
      make: " Kymco ",
      model: "Like 125",
      vehicle_type: "motorbike",
      cc: "125",
      transmission: "automatic",
    };
    expect(ownModelSchema.parse(base)).toEqual({
      make: "Kymco",
      model: "Like 125",
      vehicle_type: "motorbike",
      cc: 125,
      transmission: "automatic",
    });
    const messages = (extra: object) =>
      ownModelSchema
        .safeParse({ ...base, ...extra })
        .error?.issues.map((i) => `${String(i.path[0])}:${i.message}`);
    expect(messages({ cc: "" })).toEqual(["cc:required"]);
    expect(messages({ transmission: "" })).toEqual(["transmission:required"]);
    expect(messages({ vehicle_type: "plane" })).toEqual([
      "vehicle_type:required",
    ]);
    expect(messages({ make: " " })).toEqual(["make:required"]);
    // A motorbike without either is refused, naming both.
    expect(messages({ cc: "", transmission: "" })).toEqual([
      "cc:required",
      "transmission:required",
    ]);
    // A car, a boat, an ATV or "other" with neither is accepted.
    for (const vehicle_type of ["car", "boat", "atv", "other"])
      expect(
        ownModelSchema.parse({
          ...base,
          vehicle_type,
          cc: "",
          transmission: "",
        }),
        vehicle_type,
      ).toMatchObject({ vehicle_type, cc: null, transmission: null });
    // What a shop does give for a car is kept.
    expect(
      ownModelSchema.parse({ ...base, vehicle_type: "car", cc: "" }),
    ).toMatchObject({ cc: null, transmission: "automatic" });
    expect(vehicleTypes).toEqual(["motorbike", "car", "atv", "boat", "other"]);
    for (const type of ["car", "atv", "boat", "other"]) {
      expect(needsEngineSize(type), type).toBe(false);
      expect(needsTransmission(type), type).toBe(false);
    }
    expect(needsEngineSize("motorbike") && needsTransmission("motorbike")).toBe(
      true,
    );
  });

  it("the same make and model, ignoring case and spacing", () => {
    expect(normName("  Honda  PCX 160 ")).toBe("hondapcx160");
    expect(sameMakeModel({ make: "HONDA", model: "pcx160" }, presets[0])).toBe(
      true,
    );
    expect(sameMakeModel({ make: "Honda", model: "PCX 150" }, presets[0])).toBe(
      false,
    );
    // Every generation of it is "already in the list".
    expect(
      exactPresets("honda", "p c x 160", presets).map((p) => p.id),
    ).toEqual(["pcx26", "pcx21"]);
    expect(exactPresets("Honda", "Wave", presets)).toEqual([]);
  });

  it("suggests close matches: Did you mean Honda PCX 160?", () => {
    // Punctuation and a missing number; newest generation first.
    expect(ids("Honda", "PCX-160")).toEqual(["pcx26", "pcx21"]);
    expect(ids("Honda", "PCX")).toEqual(["pcx26", "pcx21"]);
    // A typo in the make, and in the model.
    expect(ids("Hodna", "PCX 160")).toEqual(["pcx26", "pcx21"]);
    expect(ids("Honda", "Clikc 160")[0]).toBe("click");
    // Extra words.
    expect(ids("Honda", "ADV 160 ABS")[0]).toBe("adv");
    expect(ids("Yamaha", "N-Max")).toEqual(["nmax"]);
    // The make has to be about right, and something has to be alike.
    expect(ids("Yamaha", "PCX 160")).toEqual([]);
    expect(ids("Honda", "Gold Wing")).toEqual([]);
    expect(ids("Kymco", "Like 125")).toEqual([]);
    expect(editDistance("clikc160", "click160")).toBe(2);
  });
});

describe("renewals", () => {
  const today = { year: 2026, month: 11, day: 11 };
  const renewal = (
    id: string,
    unit_id: string,
    kind: Renewal["kind"],
    expires_at: string,
  ): Renewal => ({
    id,
    unit_id,
    kind,
    provider: null,
    reference_no: null,
    starts_at: null,
    expires_at,
  });

  it("the latest expiry of each kind is the current record", () => {
    const current = currentRenewals([
      renewal("a", "u1", "road_tax", "2025-12-31"),
      renewal("b", "u1", "road_tax", "2026-12-31"),
      renewal("c", "u1", "compulsory_insurance", "2026-12-11"),
      renewal("d", "u2", "road_tax", "2026-11-01"),
    ]);
    expect(current.get("u1")?.road_tax?.id).toBe("b");
    expect(current.get("u1")?.compulsory_insurance?.id).toBe("c");
    expect(current.get("u2")?.road_tax?.id).toBe("d");
    expect(current.get("u2")?.compulsory_insurance).toBeUndefined();
  });

  it("is due from the earliest reminder day, then expired", () => {
    const days = [45, 30, 14, 7];
    expect(daysUntil("2026-12-11", today)).toBe(30);
    expect(renewalState("2026-12-11", today, days)).toBe("due");
    expect(renewalState("2026-12-26", today, days)).toBe("due"); // 45 days
    expect(renewalState("2026-12-27", today, days)).toBe("ok"); // 46 days
    expect(renewalState("2026-11-11", today, days)).toBe("due"); // today
    expect(renewalState("2026-11-10", today, days)).toBe("expired");
    // The shop's own setting decides.
    expect(renewalState("2026-12-11", today, [14, 7])).toBe("ok");
    expect(renewalState("2026-12-11", today, [])).toBe("ok");
    expect(renewalState("2026-11-10", today, [])).toBe("expired");
  });

  it("insurance expiring in 30 days shows on the dashboard; a renewed one doesn't", () => {
    const shown = renewalsToShow(
      [
        renewal("ins", "u1", "compulsory_insurance", "2026-12-11"),
        renewal("old-tax", "u1", "road_tax", "2026-11-01"),
        renewal("new-tax", "u1", "road_tax", "2027-11-01"),
        renewal("late", "u2", "road_tax", "2026-11-08"),
        renewal("far", "u2", "compulsory_insurance", "2027-06-01"),
      ],
      today,
      [45, 30, 14, 7],
    );
    expect(shown.map((r) => r.id)).toEqual(["late", "ins"]);

    const date = (iso: string) => {
      const [year, month, day] = iso.split("-").map(Number);
      return { year, month, day };
    };
    expect(
      placeItem({ kind: "renewal", date: date("2026-12-11") }, today),
    ).toEqual({
      tab: "upcoming",
      section: "renewalsDue",
    });
    expect(
      placeItem({ kind: "renewal", date: date("2026-11-08") }, today),
    ).toEqual({
      tab: "late",
      section: "overdueMaintenance",
    });
    const board = buildBoard(
      shown.map((r) => ({
        id: r.id,
        kind: "renewal" as const,
        date: date(r.expires_at),
        title: r.id,
        href: "/",
      })),
      today,
    );
    expect(board.upcoming.count).toBe(1);
    expect(board.late.count).toBe(1);
  });

  it("reads the reminder setting as typed", () => {
    const parse = (days: string, digest = "") =>
      reminderSettingsSchema.safeParse({
        renewal_reminder_days: days,
        renewal_digest_day: digest,
      });
    expect(parse("45, 30, 14, 7").data).toEqual({
      renewal_reminder_days: [45, 30, 14, 7],
      renewal_digest_day: null,
    });
    expect(parse("7 14;30,30", "1").data).toEqual({
      renewal_reminder_days: [30, 14, 7],
      renewal_digest_day: 1,
    });
    expect(parse("").data?.renewal_reminder_days).toEqual([]);
    expect(parse("0").success).toBe(false);
    expect(parse("400").success).toBe(false);
    expect(parse("soon").success).toBe(false);
    expect(parse("1,2,3,4,5,6,7,8,9,10,11").success).toBe(false);
    expect(parse("30", "31").success).toBe(false);
  });
});
