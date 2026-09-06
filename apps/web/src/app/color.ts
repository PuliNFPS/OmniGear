const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

/** Expands a short hex and applies an alpha, for simulated lighting previews. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.trim().replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value) || full.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
