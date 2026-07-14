const sensitiveKeyPattern =
  /authorization|api[-_]?token|guest[-_]?jwt|jwt|bearer|secret|signature|walletsignature/i;

export function getRecords(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const key of ["data", "records", "items", "fixtures", "odds", "scores", "updates"]) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

export function getRecordCount(payload: unknown) {
  return getRecords(payload)?.length ?? 0;
}

export function getRepresentativeRecord(payload: unknown) {
  return getRecords(payload)?.find((record) => record && typeof record === "object") ?? null;
}

export function collectObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).sort();
}

export function sanitizeForSample(value: unknown): unknown {
  return sanitize(value, 0);
}

function sanitize(value: unknown, depth: number): unknown {
  if (depth > 8) {
    return "[MaxDepth]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => sanitize(item, depth + 1));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitize(child, depth + 1),
    ]),
  );
}
