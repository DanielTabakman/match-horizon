import type { KellyMultiplier } from "../execution/pricing";

export type StrategyPresetId = "standard" | "conservative" | "custom";

export type StrategyPreset = {
  id: StrategyPresetId;
  label: string;
  description: string;
  requiredEdgePercent: number | null;
  kellyMultiplier: KellyMultiplier | null;
  useKellySizing: boolean | null;
};

export const STRATEGY_PRESETS: Record<StrategyPresetId, StrategyPreset> = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "Balanced default: 10% required edge with Half Kelly sizing.",
    requiredEdgePercent: 10,
    kellyMultiplier: "half",
    useKellySizing: true,
  },
  conservative: {
    id: "conservative",
    label: "Conservative",
    description: "Demand more edge and size more cautiously: 15% required edge with Quarter Kelly.",
    requiredEdgePercent: 15,
    kellyMultiplier: "quarter",
    useKellySizing: true,
  },
  custom: {
    id: "custom",
    label: "Custom",
    description: "Edit required edge, Kelly fraction, and sizing mode directly.",
    requiredEdgePercent: null,
    kellyMultiplier: null,
    useKellySizing: null,
  },
};

export function strategyPresetValues(id: StrategyPresetId): {
  requiredEdgePercent: number;
  kellyMultiplier: KellyMultiplier;
  useKellySizing: boolean;
} | null {
  const preset = STRATEGY_PRESETS[id];
  if (
    preset.requiredEdgePercent === null ||
    preset.kellyMultiplier === null ||
    preset.useKellySizing === null
  ) {
    return null;
  }

  return {
    requiredEdgePercent: preset.requiredEdgePercent,
    kellyMultiplier: preset.kellyMultiplier,
    useKellySizing: preset.useKellySizing,
  };
}
