import { TxlineProbeError } from "./errors";
import type { TxlineConfig } from "./env";

export type TxlineJson = unknown;

export class TxlineClient {
  private guestJwt: string | null = null;

  constructor(private readonly config: TxlineConfig) {}

  get fixturesSnapshot() {
    return this.getJson("/api/fixtures/snapshot");
  }

  getOddsSnapshot(fixtureId: string) {
    return this.getJson(`/api/odds/snapshot/${encodeURIComponent(fixtureId)}`);
  }

  getScoresSnapshot(fixtureId: string) {
    return this.getJson(`/api/scores/snapshot/${encodeURIComponent(fixtureId)}`);
  }

  getScoresHistorical(fixtureId: string) {
    return this.getJson(`/api/scores/historical/${encodeURIComponent(fixtureId)}`);
  }

  getScoresUpdates(fixtureId: string) {
    return this.getJson(`/api/scores/updates/${encodeURIComponent(fixtureId)}`);
  }

  private async getJson(path: string): Promise<TxlineJson> {
    return this.getJsonWithRetry(path, false);
  }

  private async getJsonWithRetry(path: string, didRefreshJwt: boolean): Promise<TxlineJson> {
    const guestJwt = await this.getGuestJwt(didRefreshJwt);
    const url = new URL(path, this.config.apiOrigin);
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${guestJwt}`,
          "X-Api-Token": this.config.apiToken,
          Accept: "application/json",
        },
      });
    } catch (error) {
      throw new TxlineProbeError(
        `Network request failed for ${path}: ${String(error)}`,
        "network_error",
      );
    }

    const body = await response.text();
    if (response.status === 401 && !didRefreshJwt) {
      this.guestJwt = null;
      return this.getJsonWithRetry(path, true);
    }

    if (response.status === 401 || response.status === 403) {
      throw new TxlineProbeError(
        `TxLINE authentication failed for ${path} with HTTP ${response.status}.`,
        "authentication_failed",
      );
    }

    if (!response.ok) {
      throw new TxlineProbeError(
        `TxLINE request failed for ${path} with HTTP ${response.status}: ${body.slice(0, 200)}`,
        "network_error",
      );
    }

    try {
      return JSON.parse(body) as TxlineJson;
    } catch {
      throw new TxlineProbeError(
        `TxLINE returned non-JSON data for ${path}.`,
        "malformed_payload",
      );
    }
  }

  private async getGuestJwt(forceRefresh: boolean): Promise<string> {
    if (this.guestJwt && !forceRefresh) {
      return this.guestJwt;
    }

    const url = new URL("/auth/guest/start", this.config.apiOrigin);
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json, text/plain",
        },
      });
    } catch (error) {
      throw new TxlineProbeError(
        `Guest JWT request failed: ${String(error)}`,
        "network_error",
      );
    }

    const body = await response.text();
    if (!response.ok) {
      throw new TxlineProbeError(
        `Guest JWT request failed with HTTP ${response.status}: ${body.slice(0, 200)}`,
        response.status === 401 || response.status === 403
          ? "authentication_failed"
          : "network_error",
      );
    }

    const jwt = parseGuestJwt(body);
    if (!jwt) {
      throw new TxlineProbeError(
        "Guest JWT response did not contain a token.",
        "malformed_payload",
      );
    }

    this.guestJwt = jwt;
    return jwt;
  }
}

function parseGuestJwt(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") {
      return parsed.trim() || null;
    }

    if (parsed && typeof parsed === "object") {
      for (const key of ["token", "jwt", "guestJwt", "accessToken"]) {
        const value = (parsed as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }
  } catch {
    return trimmed;
  }

  return null;
}
