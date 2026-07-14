export class TxlineProbeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_configuration"
      | "authentication_failed"
      | "empty_results"
      | "malformed_payload"
      | "network_error",
  ) {
    super(message);
    this.name = "TxlineProbeError";
  }
}
