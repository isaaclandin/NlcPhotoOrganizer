import { execute, select } from "./db";

interface CounterRow {
  next_value: number;
}

/** Read the next sequence number for a rename pattern without consuming it. */
export async function peekNextSequence(pattern: string): Promise<number> {
  const rows = await select<CounterRow>("SELECT next_value FROM counters WHERE pattern = ?", [pattern]);
  return rows.length > 0 ? rows[0].next_value : 1;
}

/**
 * Persist that `highestUsedSequence` was the highest sequence number
 * actually consumed by a *successful* rename for this pattern, so the
 * counter's next value becomes `highestUsedSequence + 1`.
 *
 * Callers must only ever pass the max sequence number among items that
 * actually succeeded — failed items must never advance the counter. Pass
 * `null` when nothing in the batch succeeded, which is a no-op: the
 * counter stays exactly where it was, so the next attempt reuses the
 * same starting number.
 *
 * This intentionally does not take a plain "count" — sequence numbers
 * are pre-assigned to items in order before we know which will succeed
 * (a real Dropbox call needs a target name to attempt), so a scattered
 * failure in the middle of a batch can "burn" that one number while a
 * later success in the same batch still advances the counter past it.
 * Only a run of trailing failures gets reclaimed, because nothing after
 * them raises the highest-successful mark.
 *
 * The `MAX(next_value, excluded.next_value)` guard means this can never
 * move the counter backwards, even if called out of order.
 */
export async function recordHighestUsedSequence(
  pattern: string,
  highestUsedSequence: number | null,
): Promise<void> {
  if (highestUsedSequence === null) return;
  const nextValue = highestUsedSequence + 1;
  await execute(
    `INSERT INTO counters (pattern, next_value) VALUES (?, ?)
     ON CONFLICT(pattern) DO UPDATE SET next_value = MAX(next_value, excluded.next_value)`,
    [pattern, nextValue],
  );
}

export async function resetSequence(pattern: string): Promise<void> {
  await execute("DELETE FROM counters WHERE pattern = ?", [pattern]);
}
