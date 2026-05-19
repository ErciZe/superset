export const ERR_NON_NUMERIC_TOTAL =
  'Crosstab totals require numeric metric values.';

export function numericValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(ERR_NON_NUMERIC_TOTAL);
  }

  return value;
}

export function addNumeric(current: unknown, next: unknown): number | null {
  const left = numericValue(current);
  const right = numericValue(next);

  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return left + right;
}
