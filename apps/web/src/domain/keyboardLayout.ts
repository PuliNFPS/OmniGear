import type { KeyboardKeySpot } from '@gearhub/shared';

export interface RowMetrics {
  /** Distance from the top of the layout to each row, in key units. */
  top: Map<number, number>;
  /** Total height of the layout, in key units. */
  height: number;
}

/** Rows follow one another, plus the extra space each layout declares above one. */
export function measureRows(keys: KeyboardKeySpot[]): RowMetrics {
  const order = [...new Set(keys.map((key) => key.row))].sort((first, second) => first - second);
  const top = new Map<number, number>();
  let cursor = 0;
  for (const row of order) {
    cursor += keys.find((key) => key.row === row)?.topGap ?? 0;
    top.set(row, cursor);
    cursor += 1;
  }
  return { top, height: cursor };
}
