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
import type { DataRecord, DataRecordValue } from '@superset-ui/core';
import { encodeTuple } from '../crosstab/keys';

export const ERR_CROSSTAB_MISSING_SQL_SUMMARY =
  'Crosstab SQL summary result is missing.';
export const ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY =
  'Crosstab SQL summary value must be numeric.';

export type SummaryResultMap = Map<string, number | null>;

type BuildSummaryResultMapArgs = {
  records: DataRecord[];
  rowFields: string[];
  columnFields: string[];
  metricFields: string[];
};

type SummaryResultKey = {
  rowValues: DataRecordValue[];
  columnValues: DataRecordValue[];
  metric: string;
};

function buildSummaryResultKey({
  rowValues,
  columnValues,
  metric,
}: SummaryResultKey): string {
  return [
    encodeTuple(rowValues),
    encodeTuple(columnValues),
    encodeTuple([metric]),
  ].join('__summary__');
}

function normalizeSummaryValue(value: DataRecordValue): number | null {
  if (value === undefined) {
    throw new Error(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY);
  }

  return value;
}

export function buildSummaryResultMap(
  args: BuildSummaryResultMapArgs,
): SummaryResultMap {
  const map: SummaryResultMap = new Map();

  args.records.forEach(record => {
    const rowValues = args.rowFields.map(field => record[field]);
    const columnValues = args.columnFields.map(field => record[field]);

    args.metricFields.forEach(metric => {
      map.set(
        buildSummaryResultKey({ rowValues, columnValues, metric }),
        normalizeSummaryValue(record[metric]),
      );
    });
  });

  return map;
}

export function getRequiredSummaryValue(
  map: SummaryResultMap,
  key: SummaryResultKey,
): number | null {
  const encodedKey = buildSummaryResultKey(key);

  if (!map.has(encodedKey)) {
    throw new Error(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  }

  return map.get(encodedKey) ?? null;
}
