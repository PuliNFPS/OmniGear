function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lists the ids of a list, or null when it is not identified entry by entry. */
function idsOf(entries: unknown[]): string[] | null {
  const ids: string[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || ids.includes(entry.id)) return null;
    ids.push(entry.id);
  }
  return ids;
}

/**
 * Compares identified entries by id, so removing a stage in the middle of the
 * list counts as one change instead of shifting every entry after it.
 */
function countListChanges(saved: unknown[], draft: unknown[]): number {
  const savedIds = idsOf(saved);
  const draftIds = idsOf(draft);

  if (!savedIds || !draftIds) {
    let total = 0;
    for (let index = 0; index < Math.max(saved.length, draft.length); index += 1) {
      total += countChanges(saved[index], draft[index]);
    }
    return total;
  }

  const savedById = new Map(savedIds.map((id, index) => [id, saved[index]]));
  const draftById = new Map(draftIds.map((id, index) => [id, draft[index]]));

  let total = 0;
  for (const id of new Set([...savedIds, ...draftIds])) {
    if (!savedById.has(id) || !draftById.has(id)) total += 1;
    else total += countChanges(savedById.get(id), draftById.get(id));
  }

  if (total === 0 && savedIds.join(' ') !== draftIds.join(' ')) return 1;
  return total;
}

/**
 * Counts how many settings differ between the profile stored on the device and
 * the current draft. Objects and lists are walked so that a single edited
 * value counts once, and an added or removed entry also counts once.
 */
export function countChanges(saved: unknown, draft: unknown): number {
  if (Object.is(saved, draft)) return 0;

  if (Array.isArray(saved) && Array.isArray(draft)) return countListChanges(saved, draft);

  if (isRecord(saved) && isRecord(draft)) {
    let total = 0;
    for (const key of new Set([...Object.keys(saved), ...Object.keys(draft)])) {
      total += countChanges(saved[key], draft[key]);
    }
    return total;
  }

  return 1;
}

export function describeChangeCount(count: number): string {
  return count === 1 ? '1 alteração não salva' : `${count} alterações não salvas`;
}
