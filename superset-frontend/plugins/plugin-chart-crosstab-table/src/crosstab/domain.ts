/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
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
  generatedColumnsPerTuple = 1,
  columnComparator?: (
    left: Record<string, unknown>,
    right: Record<string, unknown>,
  ) => number,
): unknown[][] {
  const orderedRecords = columnComparator
    ? [...records].sort(columnComparator)
    : records;
  const domains = buildColumnDomains(orderedRecords, columnFields);
  let tupleCount = 1;
  let generatedColumnCount = tupleCount * generatedColumnsPerTuple;
  if (generatedColumnCount > maxGeneratedColumns) {
    throw new Error(
      ERR_COLUMN_LIMIT(generatedColumnCount, maxGeneratedColumns),
    );
  }

  domains.forEach(domain => {
    tupleCount *= domain.length;
    generatedColumnCount = tupleCount * generatedColumnsPerTuple;
    if (generatedColumnCount > maxGeneratedColumns) {
      throw new Error(
        ERR_COLUMN_LIMIT(generatedColumnCount, maxGeneratedColumns),
      );
    }
  });

  return cartesianProduct(domains);
}
