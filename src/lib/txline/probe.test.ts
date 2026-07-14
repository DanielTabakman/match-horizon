import { describe, expect, it } from "vitest";
import { TxlineClient } from "./client";
import { getTxlineConfig } from "./env";
import { TxlineProbeError } from "./errors";
import { selectWorldCupFixture } from "./probe";
import { collectObjectKeys, getRecordCount, sanitizeForSample } from "./sample";

describe("TxLINE environment validation", () => {
  it("reports missing required configuration", () => {
    expect(() => getTxlineConfig({})).toThrow(TxlineProbeError);
  });

  it("accepts the required probe configuration", () => {
    const config = getTxlineConfig({
      TXLINE_API_ORIGIN: "https://txline.txodds.com",
      TXLINE_API_TOKEN: "token",
      TXLINE_NETWORK: "mainnet",
    });

    expect(config.apiOrigin).toBe("https://txline.txodds.com");
    expect(config.demoFixtureId).toBeNull();
  });
});

describe("TxLINE sample helpers", () => {
  it("counts arrays and object-contained arrays", () => {
    expect(getRecordCount([{ id: 1 }, { id: 2 }])).toBe(2);
    expect(getRecordCount({ records: [{ id: 1 }] })).toBe(1);
  });

  it("redacts credential-like fields in captured samples", () => {
    const sanitized = sanitizeForSample({
      Authorization: "Bearer should-not-leak",
      nested: { apiToken: "should-not-leak", FixtureId: 123 },
    });

    expect(JSON.stringify(sanitized)).not.toContain("should-not-leak");
    expect(sanitized).toEqual({
      Authorization: "[REDACTED]",
      nested: { apiToken: "[REDACTED]", FixtureId: 123 },
    });
  });

  it("collects representative keys without interpreting their meaning", () => {
    expect(collectObjectKeys({ FixtureId: 1, Competition: "World Cup" })).toEqual([
      "Competition",
      "FixtureId",
    ]);
  });
});

describe("TxLINE client authentication", () => {
  it("fetches a guest JWT and retries a data request once after HTTP 401", async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = input instanceof URL ? input.toString() : String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);

      if (url.endsWith("/auth/guest/start")) {
        return new Response(JSON.stringify({ token: `jwt-${calls.length}` }), { status: 200 });
      }

      if (calls.filter((call) => call.includes("/api/fixtures/snapshot")).length === 1) {
        return new Response("expired", { status: 401 });
      }

      return new Response(JSON.stringify([{ FixtureId: 123 }]), { status: 200 });
    }) as typeof fetch;

    try {
      const client = new TxlineClient({
        apiOrigin: "https://txline.txodds.com",
        apiToken: "api-token",
        network: "mainnet",
        demoFixtureId: null,
      });

      await expect(client.fixturesSnapshot).resolves.toEqual([{ FixtureId: 123 }]);
      expect(calls).toEqual([
        "POST https://txline.txodds.com/auth/guest/start",
        "GET https://txline.txodds.com/api/fixtures/snapshot",
        "POST https://txline.txodds.com/auth/guest/start",
        "GET https://txline.txodds.com/api/fixtures/snapshot",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("World Cup fixture selection", () => {
  const fixtures = [
    { FixtureId: 100, Competition: "Club Friendly" },
    { FixtureId: 200, Competition: "World Cup 2026" },
  ];

  it("uses configured fixture id when supplied", () => {
    expect(selectWorldCupFixture(fixtures, "100")).toEqual(fixtures[0]);
  });

  it("discovers a World Cup fixture by observed string values", () => {
    expect(selectWorldCupFixture(fixtures, null)).toEqual(fixtures[1]);
  });
});
