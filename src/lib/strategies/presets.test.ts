import { describe, expect, it } from "vitest";
import { STRATEGY_PRESETS, strategyPresetValues } from "./presets";

describe("strategy presets", () => {
  it("defines the Standard policy from the existing default controls", () => {
    expect(strategyPresetValues("standard")).toEqual({
      requiredEdgePercent: 10,
      kellyMultiplier: "half",
      useKellySizing: true,
    });
  });

  it("defines the Conservative policy with more required edge and Quarter Kelly", () => {
    expect(strategyPresetValues("conservative")).toEqual({
      requiredEdgePercent: 15,
      kellyMultiplier: "quarter",
      useKellySizing: true,
    });
  });

  it("keeps Custom free of hidden preset values", () => {
    expect(strategyPresetValues("custom")).toBeNull();
    expect(STRATEGY_PRESETS.custom.description).toMatch(/Edit required edge/);
  });
});
