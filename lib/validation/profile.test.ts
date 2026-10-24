import { describe, expect, it } from "vitest";
import {
  normaliseWhatsapp,
  notifyChannels,
  profileFormSchema,
} from "./profile";

describe("normaliseWhatsapp", () => {
  it("strips spaces, dashes, dots and brackets", () => {
    expect(normaliseWhatsapp("+66 81-234 (5678)")).toBe("+66812345678");
  });

  it("treats blank as no number", () => {
    expect(normaliseWhatsapp("  ")).toBeNull();
  });
});

describe("profileFormSchema", () => {
  it("accepts a name with an international number", () => {
    const result = profileFormSchema.parse({
      name: "  Ann ",
      whatsapp: "+44 7700 900123",
      notify: "email_whatsapp",
    });
    expect(result).toEqual({
      name: "Ann",
      whatsapp: "+447700900123",
      notify: "email_whatsapp",
    });
  });

  it("allows no number when only email is chosen", () => {
    expect(
      profileFormSchema.parse({ name: "Ann", whatsapp: "", notify: "email" })
        .whatsapp,
    ).toBeNull();
  });

  it("rejects numbers without a country code", () => {
    expect(
      profileFormSchema.safeParse({
        name: "Ann",
        whatsapp: "0812345678",
        notify: "email",
      }).success,
    ).toBe(false);
  });

  it("requires a number for WhatsApp messages", () => {
    const result = profileFormSchema.safeParse({
      name: "Ann",
      whatsapp: "",
      notify: "email_whatsapp",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["whatsapp"]);
  });

  it("requires a name", () => {
    expect(
      profileFormSchema.safeParse({ name: " ", whatsapp: "", notify: "email" })
        .success,
    ).toBe(false);
  });
});

describe("notifyChannels", () => {
  it("always includes email", () => {
    expect(notifyChannels("email")).toEqual(["email"]);
    expect(notifyChannels("email_whatsapp")).toEqual(["email", "whatsapp"]);
  });
});
