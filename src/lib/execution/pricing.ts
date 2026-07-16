export const KELLY_MULTIPLIERS = {
  quarter: 0.25,
  half: 0.5,
  full: 1,
} as const;

export type KellyMultiplier = keyof typeof KELLY_MULTIPLIERS;

export type PricingPolicy = {
  userProbability: number;
  requiredEdge: number;
  fairDecimalOdds: number;
  minimumDecimalOdds: number;
};

export type KellySizingPolicy = PricingPolicy & {
  bankroll: number;
  kellyMultiplier: KellyMultiplier;
  fullKellyFraction: number;
  appliedKellyFraction: number;
  suggestedStake: number;
};

export function calculatePricingPolicy(userProbability: number, requiredEdge: number): PricingPolicy {
  validateProbability(userProbability);
  if (!Number.isFinite(requiredEdge) || requiredEdge < 0) {
    throw new Error("Required edge must be finite and non-negative.");
  }

  return {
    userProbability,
    requiredEdge,
    fairDecimalOdds: 1 / userProbability,
    minimumDecimalOdds: (1 + requiredEdge) / userProbability,
  };
}

export function calculateExpectedReturn(userProbability: number, decimalOdds: number): number {
  validateProbability(userProbability);
  validateDecimalOdds(decimalOdds);

  return userProbability * decimalOdds - 1;
}

export function calculateFullKellyFraction(userProbability: number, decimalOdds: number): number {
  const expectedReturn = calculateExpectedReturn(userProbability, decimalOdds);
  if (expectedReturn <= 0) {
    return 0;
  }

  return expectedReturn / (decimalOdds - 1);
}

export function calculateKellySizingPolicy({
  userProbability,
  requiredEdge,
  bankroll,
  kellyMultiplier,
}: {
  userProbability: number;
  requiredEdge: number;
  bankroll: number;
  kellyMultiplier: KellyMultiplier;
}): KellySizingPolicy {
  const pricingPolicy = calculatePricingPolicy(userProbability, requiredEdge);

  if (!Number.isFinite(bankroll) || bankroll <= 0) {
    throw new Error("Strategy bankroll must be finite and greater than 0.");
  }

  const multiplier = KELLY_MULTIPLIERS[kellyMultiplier];
  if (multiplier === undefined) {
    throw new Error("Kelly multiplier must be quarter, half, or full.");
  }

  const fullKellyFraction = calculateFullKellyFraction(userProbability, pricingPolicy.minimumDecimalOdds);
  const appliedKellyFraction = fullKellyFraction * multiplier;

  return {
    ...pricingPolicy,
    bankroll,
    kellyMultiplier,
    fullKellyFraction,
    appliedKellyFraction,
    suggestedStake: roundMoney(bankroll * appliedKellyFraction),
  };
}

function validateProbability(userProbability: number) {
  if (!Number.isFinite(userProbability) || userProbability <= 0 || userProbability > 1) {
    throw new Error("User probability must be finite, greater than 0, and no more than 1.");
  }
}

function validateDecimalOdds(decimalOdds: number) {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error("Decimal odds must be finite and greater than 1.");
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
