/**
 * Lift-off distance levels.
 *
 * The device stores an index, not a distance: it reported `lod: 2` while the
 * official software offers 0.7 mm to 2.0 mm, and shows them as radio buttons
 * rather than a slider, so the steps are discrete and unevenly spaced.
 *
 * Rendering the raw index as millimetres printed "2.0 mm" for what the mouse
 * actually holds at 1.0 mm.
 */
export interface LodLevel {
  /** Value stored in the snapshot's `lod` field. */
  raw: number;
  millimetres: number;
}

export const LEVIATHAN_V4_LOD_LEVELS: LodLevel[] = [
  { raw: 1, millimetres: 0.7 },
  { raw: 2, millimetres: 1.0 },
  { raw: 3, millimetres: 2.0 },
];

/** Falls back to the raw value so an unknown level is visible, not hidden. */
export function formatLiftOffDistance(raw: number): string {
  const level = LEVIATHAN_V4_LOD_LEVELS.find((item) => item.raw === raw);
  if (!level) return `nível ${raw}`;
  return `${level.millimetres.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm`;
}
