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
 */
export const leviathanV4QueryFixture: Record<string, unknown> = {
  r: 'G-1.2.3',
  rc: 9,
  dn: 'LEVIATHAN V4',
  pi: 9034,
  vi: 6421,
  battery: 31,
  chr: 0,
  cpi: 800,
  polling: 4000,
  light: 48,
  cpi_l: [400, 800, 1600, 3200, 0, 0, 0, 0],
  cpi_l_c: [1, 2, 6, 4, 0, 0, 0, 0],
  ob: 0,
  esb_addr: '00000000000000000000000000000000',
  msg: '',
  cn: 8,
  pm: 3,
  esb_ch: 0,
  lod: 2,
  lod_c: 0,
  kd: [0, 0, 0, 0, 0, 0, 0],
  ms: 1,
  at: 0,
  at2: 0,
  as: 0,
  rctrl: 0,
  top: 8,
  atp: 1,
  co: '',
  lz: 0,
  st: 60,
  rf_ch: 2,
  crc: 1,
  lua: 255,
  noack: 0,
  gm: [0, 0],
  ocn: 4,
  oci: 0,
  ocs: [129, 130, 134, 132],
  ec: 1,
  dgom: 1,
  sst: 'PAW3950',
  lbn: 128,
  hc: 1,
  rr: 'G-1.0.0',
  rrc: 1,
};

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
