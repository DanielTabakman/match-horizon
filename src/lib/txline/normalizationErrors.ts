export class TxlineNormalizationError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported_market" | "ambiguous_data" | "malformed_payload",
  ) {
    super(message);
    this.name = "TxlineNormalizationError";
  }
}
