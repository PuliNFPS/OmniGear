/**
 * Lift-off distance levels.
 *
 * The device stores an index, not a distance: it reports `lod: 2` for a mouse
 * sitting at 1.0 mm. The official software presents the three as named levels
 * rather than measurements, so the name leads and the distance follows it.
 *
 * Confirmed against that software: low is 0.7 mm, medium 1.0 mm, high 2.0 mm.
 */
export interface LodLevel {
  /** Value stored in the snapshot's `lod` field. */
  raw: number;
  name: string;
  millimetres: number;
}

export const LEVIATHAN_V4_LOD_LEVELS: LodLevel[] = [
  { raw: 1, name: 'Baixo', millimetres: 0.7 },
  { raw: 2, name: 'Médio', millimetres: 1.0 },
  { raw: 3, name: 'Alto', millimetres: 2.0 },
];

/** Falls back to the raw value so an unknown level stays visible, not hidden. */
export function formatLiftOffDistance(raw: number): string {
  const level = LEVIATHAN_V4_LOD_LEVELS.find((item) => item.raw === raw);
  if (!level) return `nível ${raw}`;
  const distance = level.millimetres.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
  return `${level.name} · ${distance} mm`;
}
