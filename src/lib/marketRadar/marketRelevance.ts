import type { ObservationWithMapping } from "./types";

export type MarketRelevance = "world-cup-soccer" | "other-sports" | "non-sports";
export type MarketScope = "world-cup-soccer" | "all-sports" | "all-imported";

export type RankedObservationForScope = {
  observation: ObservationWithMapping;
  score: { total: number };
};

const SOCCER_METADATA_PATTERNS = [
  /\bsoccer\b/i,
  /\bfifa\b/i,
  /\bworld cup\b/i,
  /\buefa\b/i,
  /\bchampions league\b/i,
  /\bpremier league\b/i,
  /\bla liga\b/i,
  /\bserie a\b/i,
  /\bbundesliga\b/i,
  /\bmls\b/i,
  /\bcopa america\b/i,
  /\bcopa am[ée]rica\b/i,
  /\bconcacaf\b/i,
  /\blibertadores\b/i,
  /\beuropa league\b/i,
];

const SOCCER_TEXT_PATTERNS = [
  ...SOCCER_METADATA_PATTERNS,
  /\bassociation football\b/i,
  /\bfootball club\b/i,
  /\bfc\b/i,
];

const AMERICAN_FOOTBALL_PATTERNS = [
  /\bnfl\b/i,
  /\bncaa football\b/i,
  /\bcollege football\b/i,
  /\bamerican football\b/i,
  /\bsuper bowl\b/i,
];

const OTHER_SPORT_PATTERNS = [
  /\bbasketball\b/i,
  /\bnba\b/i,
  /\bwnba\b/i,
  /\bncaa basketball\b/i,
  /\bbaseball\b/i,
  /\bmlb\b/i,
  /\bhockey\b/i,
  /\bnhl\b/i,
  /\btennis\b/i,
  /\bmma\b/i,
  /\bufc\b/i,
  /\bboxing\b/i,
  /\bcricket\b/i,
  /\brugby\b/i,
  /\bgolf\b/i,
  /\besports?\b/i,
  ...AMERICAN_FOOTBALL_PATTERNS,
];

const NON_SPORT_METADATA_PATTERNS = [
  /\bpolitics?\b/i,
  /\belections?\b/i,
  /\bcrypto(?:currency)?\b/i,
  /\bbitcoin\b/i,
  /\beth(?:ereum)?\b/i,
  /\bmacro(?:economic)?\b/i,
  /\beconom(?:y|ics|ic)\b/i,
  /\bcelebrit(?:y|ies)\b/i,
  /\bentertainment\b/i,
  /\btechnology\b/i,
  /\btech\b/i,
  /\bgeopolitics?\b/i,
  /\bukraine\b/i,
  /\bnato\b/i,
];

const NON_SPORT_TEXT_PATTERNS = [
  ...NON_SPORT_METADATA_PATTERNS,
  /\bpresident(?:ial)?\b/i,
  /\bsenate\b/i,
  /\bcongress\b/i,
  /\belected\b/i,
  /\bcpi\b/i,
  /\bfed\b/i,
  /\brates?\b/i,
  /\btrump\b/i,
  /\bbiden\b/i,
  /\btaylor swift\b/i,
  /\boscar\b/i,
  /\biphone\b/i,
  /\bmilitary\b/i,
  /\btroops?\b/i,
  /\bwar\b/i,
  /\bcombat\b/i,
  /\bmissile\b/i,
  /\bsovereignty\b/i,
];

export function classifyMarketRelevance(observation: Pick<ObservationWithMapping, "sport" | "category" | "title" | "resolutionSummary">): MarketRelevance {
  const metadata = normalizeText([observation.sport, observation.category].join(" "));
  const text = normalizeText([observation.title, observation.resolutionSummary].join(" "));

  if (metadata && matchesAny(metadata, SOCCER_METADATA_PATTERNS)) {
    return "world-cup-soccer";
  }
  if (metadata && matchesAny(metadata, AMERICAN_FOOTBALL_PATTERNS)) {
    return "other-sports";
  }
  if (metadata && matchesAny(metadata, OTHER_SPORT_PATTERNS)) {
    return "other-sports";
  }
  if (metadata && /\bfootball\b/i.test(metadata)) {
    return matchesAny(text, SOCCER_TEXT_PATTERNS) && !matchesAny(text, AMERICAN_FOOTBALL_PATTERNS)
      ? "world-cup-soccer"
      : "other-sports";
  }
  if (metadata && matchesAny(metadata, NON_SPORT_METADATA_PATTERNS)) {
    return "non-sports";
  }

  if (matchesAny(text, NON_SPORT_TEXT_PATTERNS)) {
    return "non-sports";
  }
  if (isGenericYesNo(observation.title, observation.resolutionSummary)) {
    return "non-sports";
  }
  if (matchesAny(text, SOCCER_TEXT_PATTERNS) && !matchesAny(text, AMERICAN_FOOTBALL_PATTERNS)) {
    return "world-cup-soccer";
  }
  if (matchesAny(text, OTHER_SPORT_PATTERNS)) {
    return "other-sports";
  }

  return "non-sports";
}

export function observationMatchesMarketScope(observation: ObservationWithMapping, scope: MarketScope): boolean {
  const relevance = classifyMarketRelevance(observation);
  if (scope === "all-imported") {
    return true;
  }
  if (scope === "all-sports") {
    return relevance !== "non-sports";
  }
  return relevance === "world-cup-soccer";
}

export function sortScopedObservations<T extends RankedObservationForScope>(items: T[], scope: MarketScope): T[] {
  if (scope !== "world-cup-soccer") {
    return items.slice().sort((left, right) => right.score.total - left.score.total);
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const bucketDelta = soccerPriorityBucket(left.item.observation) - soccerPriorityBucket(right.item.observation);
      if (bucketDelta !== 0) {
        return bucketDelta;
      }
      const scoreDelta = right.item.score.total - left.item.score.total;
      return scoreDelta !== 0 ? scoreDelta : left.index - right.index;
    })
    .map(({ item }) => item);
}

export function marketScopeLabel(scope: MarketScope): string {
  if (scope === "all-imported") {
    return "all imported";
  }
  if (scope === "all-sports") {
    return "sports";
  }
  return "World Cup & soccer";
}

function soccerPriorityBucket(observation: ObservationWithMapping): number {
  const text = normalizeText([observation.sport, observation.category, observation.title, observation.resolutionSummary].join(" "));
  if (/\b(?:world cup|fifa)\b/i.test(text)) {
    return 0;
  }
  if (observation.mapping) {
    return 1;
  }
  return 2;
}

function isGenericYesNo(title: string, resolutionSummary: string | null): boolean {
  const text = normalizeText(`${title} ${resolutionSummary ?? ""}`);
  return /^(will|is|are|does|do|can|did|was|were)\b/i.test(text) && !matchesAny(text, [...SOCCER_TEXT_PATTERNS, ...OTHER_SPORT_PATTERNS]);
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
