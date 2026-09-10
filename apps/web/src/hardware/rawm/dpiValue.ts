/** CPI2 packs X into the low 16 bits and Y into the high 16 bits. */
export function dpiAxes(value: number): { x: number; y: number } {
  const x = value & 0xffff;
  return { x, y: value >>> 16 || x };
}
