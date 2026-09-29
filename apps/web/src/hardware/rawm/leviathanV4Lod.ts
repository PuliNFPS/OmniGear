import { leviathanLodMillimetres } from '../../core/coreBridge';

/**
 * Lift-off distance levels, as the screen names them.
 *
 * The device stores an index, not a distance: it reports `lod: 2` for a mouse
 * sitting at 1.0 mm. The official software presents the three as named levels
 * rather than measurements, so the name leads and the distance follows it.
 * The distances are device facts and live in the core; the names are ours.
 */
const LEVEL_NAMES: Record<number, string> = { 1: 'Baixo', 2: 'Médio', 3: 'Alto' };

/** Falls back to the raw value so an unknown level stays visible, not hidden. */
export function formatLiftOffDistance(raw: number): string {
  const name = LEVEL_NAMES[raw];
  if (name === undefined) return `nível ${raw}`;
  // Chamado durante a renderização: com o núcleo que falhou ao iniciar, o
  // `main.tsx` promete que a tela ainda aparece, então a ponte não pode derrubá-la.
  let millimetres: number | null;
  try {
    millimetres = leviathanLodMillimetres(raw);
  } catch {
    return `nível ${raw}`;
  }
  if (millimetres === null) return `nível ${raw}`;
  const distance = millimetres.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
  return `${name} · ${distance} mm`;
}
