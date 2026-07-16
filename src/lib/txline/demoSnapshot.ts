import type { Fixture, MarketSnapshot } from "../domain";
import { normalizeTxlineFixture } from "./normalizeFixture";
import { normalizeTxlineMatchResultMarket } from "./normalizeOdds";
import type { TxlineFixtureRecord, TxlineOddsRecord, TxlineSampleEnvelope } from "./schemas";
import fixturesCapture from "../../../test-fixtures/txline/fixtures-snapshot.json";
import oddsCapture from "../../../test-fixtures/txline/odds-snapshot.json";

const DEMO_FIXTURE_ID = "18237038";

export type DemoSnapshot = {
  fixture: Fixture;
  market: MarketSnapshot;
};

export function loadDemoSnapshot(): DemoSnapshot | null {
  const fixtures = fixturesCapture as TxlineSampleEnvelope<TxlineFixtureRecord>;
  const odds = oddsCapture as TxlineSampleEnvelope<TxlineOddsRecord>;
  const fixtureRecord = fixtures.sample.find(
    (record) => String(record.FixtureId) === DEMO_FIXTURE_ID,
  );

  if (!fixtureRecord) {
    return null;
  }

  const fixture = normalizeTxlineFixture(fixtureRecord);
  const market = normalizeTxlineMatchResultMarket(odds.sample, fixture, odds.capturedAt);

  return { fixture, market };
}
