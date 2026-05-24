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
import {
  getColumnLabel,
  type DataRecord,
  type DataRecordValue,
} from '@superset-ui/core';
import type {
  CrosstabNullSort,
  CrosstabSortDirection,
  CrosstabSortType,
  DimensionFieldConfig,
} from '../types';

const ERR_CROSSTAB_SORT_FIELD =
  'Crosstab sort field must resolve to a column label.';
const ERR_CROSSTAB_SORT_VALUE =
  'Crosstab sort value must match its configured type.';
const ERR_CROSSTAB_SORT_DIRECTION =
  'Crosstab sort direction must be "asc" or "desc".';
const ERR_CROSSTAB_SORT_NULLS =
  'Crosstab null placement must be "first" or "last".';
const ERR_CROSSTAB_SORT_TYPE =
  'Crosstab sort type must be "string", "number", or "date".';

type NormalizedSortValue = string | number;
type NormalizedSortConfig = {
  direction: CrosstabSortDirection;
  field: string;
  nulls: CrosstabNullSort;
  type: CrosstabSortType;
};

function getDimensionField(config: DimensionFieldConfig): string {
  const label = getColumnLabel(config.field);
  if (!label) {
    throw new Error(ERR_CROSSTAB_SORT_FIELD);
  }
  return label;
}

function getSortField(config: DimensionFieldConfig): string {
  const sortBy = config.sort?.by ?? 'self';
  const sortField = sortBy === 'self' ? config.field : sortBy;
  const label = getColumnLabel(sortField);
  if (!label) {
    throw new Error(ERR_CROSSTAB_SORT_FIELD);
  }
  return label;
}

function hasSortField(record: DataRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function getSortDirection(config: DimensionFieldConfig): CrosstabSortDirection {
  const direction = config.sort?.direction ?? 'asc';

  if (direction === 'asc' || direction === 'desc') {
    return direction;
  }

  throw new Error(ERR_CROSSTAB_SORT_DIRECTION);
}

function getNullPlacement(config: DimensionFieldConfig): CrosstabNullSort {
  const nulls = config.sort?.nulls ?? 'last';

  if (nulls === 'first' || nulls === 'last') {
    return nulls;
  }

  throw new Error(ERR_CROSSTAB_SORT_NULLS);
}

function getSortType(config: DimensionFieldConfig): CrosstabSortType {
  const sortType = config.sort?.type ?? 'string';

  if (sortType === 'string' || sortType === 'number' || sortType === 'date') {
    return sortType;
  }

  throw new Error(ERR_CROSSTAB_SORT_TYPE);
}

function getNormalizedSortConfig(
  config: DimensionFieldConfig,
): NormalizedSortConfig {
  return {
    direction: getSortDirection(config),
    field: getSortField(config),
    nulls: getNullPlacement(config),
    type: getSortType(config),
  };
}

function normalizeNumber(value: DataRecordValue): number {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }
    throw new Error(ERR_CROSSTAB_SORT_VALUE);
  }

  if (typeof value === 'bigint') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
    throw new Error(ERR_CROSSTAB_SORT_VALUE);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  throw new Error(ERR_CROSSTAB_SORT_VALUE);
}

function normalizeDate(value: DataRecordValue): number {
  let timestamp: number;

  if (value instanceof Date) {
    timestamp = value.getTime();
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    timestamp = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    timestamp = Date.parse(value);
  } else {
    throw new Error(ERR_CROSSTAB_SORT_VALUE);
  }

  if (Number.isFinite(timestamp)) {
    return timestamp;
  }

  throw new Error(ERR_CROSSTAB_SORT_VALUE);
}

function normalizeString(value: DataRecordValue): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean' ||
    value instanceof Date
  ) {
    return value.toString();
  }

  throw new Error(ERR_CROSSTAB_SORT_VALUE);
}

function normalizeValue(
  value: DataRecordValue,
  sortType: CrosstabSortType,
): NormalizedSortValue | null {
  if (value === null) {
    return null;
  }

  switch (sortType) {
    case 'number':
      return normalizeNumber(value);
    case 'date':
      return normalizeDate(value);
    case 'string':
      return normalizeString(value);
    default:
      throw new Error(ERR_CROSSTAB_SORT_TYPE);
  }
}

function compareNormalizedValues(
  left: NormalizedSortValue,
  right: NormalizedSortValue,
): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  const leftString = left.toString();
  const rightString = right.toString();

  if (leftString === rightString) {
    return 0;
  }

  return leftString < rightString ? -1 : 1;
}

function compareNullableValues(
  left: NormalizedSortValue | null,
  right: NormalizedSortValue | null,
  nulls: CrosstabNullSort,
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return nulls === 'first' ? -1 : 1;
  }

  if (right === null) {
    return nulls === 'first' ? 1 : -1;
  }

  return compareNormalizedValues(left, right);
}

export function buildDimensionOrderBy(
  configs: DimensionFieldConfig[],
): [string, boolean][] {
  return configs.map(config => [
    getSortField(config),
    getSortDirection(config) === 'asc',
  ]);
}

export function getDimensionSortFields(
  configs: DimensionFieldConfig[],
): string[] {
  configs.forEach(config => {
    getSortDirection(config);
    getNullPlacement(config);
    getSortType(config);
  });

  const visibleDimensions = new Set(configs.map(getDimensionField));
  const sortFields = new Set<string>();

  configs.forEach(config => {
    const sortField = getSortField(config);
    if (!visibleDimensions.has(sortField)) {
      sortFields.add(sortField);
    }
  });

  return [...sortFields];
}

export function compareDataRecordsByDimensionSort(
  configs: DimensionFieldConfig[],
): (left: DataRecord, right: DataRecord) => number {
  const sortConfigs = configs.map(getNormalizedSortConfig);

  return (left, right) => {
    for (const { direction, field, nulls, type } of sortConfigs) {
      if (!hasSortField(left, field) || !hasSortField(right, field)) {
        throw new Error(ERR_CROSSTAB_SORT_FIELD);
      }

      const leftValue = normalizeValue(left[field], type);
      const rightValue = normalizeValue(right[field], type);
      const compareResult = compareNullableValues(leftValue, rightValue, nulls);

      if (compareResult !== 0) {
        return leftValue !== null && rightValue !== null && direction === 'desc'
          ? -compareResult
          : compareResult;
      }
    }

    return 0;
  };
}
