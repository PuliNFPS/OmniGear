import { readProtocolVectors } from '../../test/vectors';

/**
 * Real query response from a RAWM Leviathan V4, captured on 2026-09-06 by the
 * read-only probe at diagnostico.html. Firmware G-1.2.3, sensor PAW3950.
 *
 * Only `esb_addr` was changed: it is the pairing address and identifies the
 * physical device. Every other value is verbatim, including the trailing zero
 * padding in `cpi_l`/`cpi_l_c`, the empty-string `co` and the numeric `st` —
 * those three are exactly what the strict parser used to reject.
 *
 * The mouse was in its highest-power state when captured: 4000 Hz, performance
 * mode 3 (Gaming+), wireless turbo on (`top` 8).
 *
 * The values live in packages/core/vectors/rawm-protocol.json, shared with the Rust tests.
 */
export const leviathanV4QueryFixture: Record<string, unknown> =
  readProtocolVectors().queries['leviathan-v4-captura'];

/** Receiver response from the same capture, for the physical channel. */
export const rawmReceiverQueryFixture: Record<string, unknown> = {
  r: 'G-2.0.3',
  rc: 5,
  dn: 'RAWM HS Receiver',
  pi: 9030,
  vi: 6421,
  msg: '',
  cn: 0,
  esb_addr: '00000000000000000000000000000000',
  esb_ch: 255,
  light: 1,
  slow: 0,
};
