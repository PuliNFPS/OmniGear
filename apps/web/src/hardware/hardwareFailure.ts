/**
 * Surfaces a hardware failure instead of swallowing it.
 *
 * Every catch around a device operation used to be a bare `catch {`, and the
 * app logged nothing anywhere. The screen said "não foi possível aplicar os
 * ajustes" and that was the entire record of what went wrong, which makes a
 * failure on real hardware impossible to diagnose from a report.
 *
 * The errors these paths throw already name themselves — a timeout says which
 * operation timed out, an unknown key says which key — so the message alone is
 * usually enough to place the fault.
 */
export function reportHardwareFailure(operation: string, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[OmniGear] Falha ao ${operation}: ${detail}`, error);
}
