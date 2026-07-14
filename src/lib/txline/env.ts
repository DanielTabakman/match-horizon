import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TxlineProbeError } from "./errors";

export type TxlineNetwork = "mainnet" | "devnet";

export type TxlineConfig = {
  apiOrigin: string;
  apiToken: string;
  network: TxlineNetwork;
  demoFixtureId: string | null;
};

const envFiles = [".env.local", ".env"];
const networkOrigins: Record<TxlineNetwork, string> = {
  mainnet: "https://txline.txodds.com",
  devnet: "https://txline-dev.txodds.com",
};

export function loadLocalEnvFiles(cwd = process.cwd()) {
  for (const file of envFiles) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) {
      continue;
    }

    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separator = line.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      const existing = process.env[key];
      if (existing !== undefined && existing !== "") {
        continue;
      }

      process.env[key] = unquote(line.slice(separator + 1).trim());
    }
  }
}

export function getTxlineConfig(
  env: Record<string, string | undefined> = process.env,
): TxlineConfig {
  const missing = requiredEnvKeys.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new TxlineProbeError(
      `Missing required TxLINE environment variables: ${missing.join(", ")}`,
      "missing_configuration",
    );
  }

  const network = parseNetwork(env.TXLINE_NETWORK);
  const apiOrigin = resolveApiOrigin(network, env.TXLINE_API_ORIGIN_OVERRIDE);

  return {
    apiOrigin,
    apiToken: env.TXLINE_API_TOKEN!.trim(),
    network,
    demoFixtureId: env.TXLINE_DEMO_FIXTURE_ID?.trim() || null,
  };
}

const requiredEnvKeys = [
  "TXLINE_API_TOKEN",
  "TXLINE_NETWORK",
] as const;

function resolveApiOrigin(network: TxlineNetwork, override: string | undefined) {
  const expectedOrigin = networkOrigins[network];
  const raw = override?.trim();
  if (!raw) {
    return expectedOrigin;
  }

  const overrideOrigin = parseApiOrigin(raw, "TXLINE_API_ORIGIN_OVERRIDE");
  if (overrideOrigin !== expectedOrigin) {
    throw new TxlineProbeError(
      `TXLINE_API_ORIGIN_OVERRIDE must match the selected TXLINE_NETWORK origin (${expectedOrigin}).`,
      "missing_configuration",
    );
  }

  return overrideOrigin;
}

function parseApiOrigin(value: string | undefined, key: string) {
  const raw = value?.trim();
  if (!raw) {
    throw new TxlineProbeError(`${key} is required.`, "missing_configuration");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TxlineProbeError(
      `${key} must be a valid http(s) URL.`,
      "missing_configuration",
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TxlineProbeError(
      `${key} must use http or https.`,
      "missing_configuration",
    );
  }

  return url.origin;
}

function parseNetwork(value: string | undefined): TxlineNetwork {
  const raw = value?.trim().toLowerCase();
  if (raw === "mainnet" || raw === "devnet") {
    return raw;
  }

  throw new TxlineProbeError(
    "TXLINE_NETWORK must be either mainnet or devnet.",
    "missing_configuration",
  );
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
