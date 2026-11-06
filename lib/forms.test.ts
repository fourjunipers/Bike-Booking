import { describe, expect, it } from "vitest";
import { failed, invalid, mergeStates, savedState } from "./forms";

describe("mergeStates", () => {
  it("is saved when every section saved", () => {
    expect(mergeStates([savedState, savedState])).toEqual(savedState);
  });

  it("collects every section's field errors", () => {
    expect(
      mergeStates([
        invalid({ name: "required" }),
        savedState,
        invalid({ whatsapp: "phone" }),
      ]),
    ).toEqual(invalid({ name: "required", whatsapp: "phone" }));
  });

  it("reports a failure over field errors", () => {
    expect(mergeStates([invalid({ name: "required" }), failed])).toEqual(
      failed,
    );
  });
});
