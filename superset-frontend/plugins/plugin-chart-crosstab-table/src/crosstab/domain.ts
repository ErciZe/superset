import { encodeKey } from './keys';

export const ERR_COLUMN_LIMIT = (actual: number, limit: number) =>
  `Crosstab generated ${actual} columns, which exceeds the limit of ${limit}.`;

export function buildColumnDomains(
  records: Record<string, unknown>[],
  columnFields: string[],
): unknown[][] {
  return columnFields.map(field => {
    const seen = new Set<string>();
    const domain: unknown[] = [];

    records.forEach(record => {
      const value = record[field];
      const key = encodeKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        domain.push(value);
      }
    });

    return domain;
  });
}

export function cartesianProduct(domains: unknown[][]): unknown[][] {
  return domains.reduce<unknown[][]>(
    (tuples, domain) =>
      tuples.flatMap(tuple => domain.map(value => [...tuple, value])),
    [[]],
  );
}

export function buildColumnTuples(
  records: Record<string, unknown>[],
  columnFields: string[],
  maxGeneratedColumns: number,
): unknown[][] {
  const tuples = cartesianProduct(buildColumnDomains(records, columnFields));
  if (tuples.length > maxGeneratedColumns) {
    throw new Error(ERR_COLUMN_LIMIT(tuples.length, maxGeneratedColumns));
  }

  return tuples;
}
