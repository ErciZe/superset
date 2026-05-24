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
  DataRecord,
  DataRecordValue,
  getColumnLabel,
  JsonObject,
  QueryFormColumn,
} from '@superset-ui/core';
import type { DimensionFieldConfig } from '../types';

export const DEFAULT_COLUMN_PAGE_SIZE = 98;
export const DEFAULT_GENERATED_COLUMN_WIDTH = 120;
export const ERR_SERVER_COLUMN_PAGINATION_COLUMNS =
  'Crosstab server column pagination only supports physical column dimensions.';
export const ERR_SERVER_COLUMN_PAGINATION_SHAPE =
  'Crosstab server column pagination currently requires exactly one row dimension and at least one metric.';
export const ERR_SERVER_COLUMN_PAGINATION_ROW_LIMIT =
  'Crosstab server column pagination query reached the row limit. Reduce the column page size or add filters.';

export type CrosstabOwnState = JsonObject & {
  currentColumnPage?: number;
  currentColumnPageSize?: number;
  serverColumnPageColumnSignature?: string;
  serverColumnPageTuples?: DataRecordValue[][];
  serverColumnPageTuplesPage?: number;
  serverColumnPageTuplesPageSize?: number;
  serverColumnTotalCount?: number;
};

export function getColumnPageSize(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : DEFAULT_COLUMN_PAGE_SIZE;

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_COLUMN_PAGE_SIZE;
  }

  return parsed;
}

export function getGeneratedColumnWidth(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : DEFAULT_GENERATED_COLUMN_WIDTH;

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_GENERATED_COLUMN_WIDTH;
  }

  return parsed;
}

export function getCurrentColumnPage(ownState?: JsonObject): number {
  const value = (ownState as CrosstabOwnState | undefined)?.currentColumnPage;

  return Number.isInteger(value) && value !== undefined && value >= 0
    ? value
    : 0;
}

function getSortSignature(config: DimensionFieldConfig): string {
  if (!config.sort) {
    const label = getColumnLabel(config.field);
    if (!label) {
      throw new Error(ERR_SERVER_COLUMN_PAGINATION_COLUMNS);
    }

    return label;
  }

  const sortBy = config.sort.by === 'self' ? config.field : config.sort.by;
  const fieldLabel = getColumnLabel(config.field);
  const sortLabel = getColumnLabel(sortBy);

  if (!fieldLabel || !sortLabel) {
    throw new Error(ERR_SERVER_COLUMN_PAGINATION_COLUMNS);
  }

  return [
    fieldLabel,
    sortLabel,
    config.sort.direction ?? 'asc',
    config.sort.type ?? 'string',
    config.sort.nulls ?? 'last',
  ].join('\u001e');
}

function isDimensionFieldConfig(
  value: string | DimensionFieldConfig,
): value is DimensionFieldConfig {
  return typeof value !== 'string';
}

export function getServerColumnPageColumnSignature(
  columns: string[] | DimensionFieldConfig[],
): string {
  return columns.some(isDimensionFieldConfig)
    ? (columns as DimensionFieldConfig[]).map(getSortSignature).join('\u001f')
    : (columns as string[]).join('\u001f');
}

export function assertServerColumnPaginationShape(
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
  metricCount: number,
) {
  if (rowDimensions.length !== 1 || metricCount < 1) {
    throw new Error(ERR_SERVER_COLUMN_PAGINATION_SHAPE);
  }

  if (
    [...rowDimensions, ...columnDimensions].some(
      column => typeof column !== 'string',
    )
  ) {
    throw new Error(ERR_SERVER_COLUMN_PAGINATION_COLUMNS);
  }
}

export function getServerColumnPageTuples(
  ownState: JsonObject | undefined,
  currentPage: number,
  currentPageSize: number,
  columns: string[],
  columnSignature = getServerColumnPageColumnSignature(columns),
): DataRecordValue[][] {
  const state = ownState as CrosstabOwnState | undefined;

  if (state?.serverColumnPageTuplesPage !== currentPage) {
    return [];
  }

  if (
    state.serverColumnPageTuplesPageSize !== undefined &&
    state.serverColumnPageTuplesPageSize !== currentPageSize
  ) {
    return [];
  }

  const tuples = Array.isArray(state.serverColumnPageTuples)
    ? state.serverColumnPageTuples
    : [];
  if (
    state.serverColumnPageColumnSignature !== undefined &&
    state.serverColumnPageColumnSignature !== columnSignature
  ) {
    return [];
  }

  if (tuples.some(tuple => tuple.length !== columns.length)) {
    return [];
  }

  return tuples;
}

function sqlColumnName(column: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    throw new Error(ERR_SERVER_COLUMN_PAGINATION_COLUMNS);
  }

  return column;
}

function isTemporalColumn(column: string): boolean {
  return /(?:^|_)(?:date|time|dttm|timestamp)(?:_|$)/i.test(column);
}

function isEpochMillis(value: number): boolean {
  return Number.isInteger(value) && Math.abs(value) >= 100_000_000_000;
}

function formatUtcDateTime(value: number): string {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

function sqlValue(column: string, value: DataRecordValue): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Unsupported crosstab filter value: ${value}`);
    }

    return isTemporalColumn(column) && isEpochMillis(value)
      ? `'${formatUtcDateTime(value)}'`
      : String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildColumnTupleWhereClause(
  columns: string[],
  tuples: DataRecordValue[][],
): string {
  if (!tuples.length) {
    return '1 = 0';
  }

  return tuples
    .map(tuple => {
      if (tuple.length !== columns.length) {
        throw new Error('Invalid crosstab column page tuple.');
      }

      return `(${columns
        .map((column, index) => {
          const columnName = sqlColumnName(column);
          const value = tuple[index];

          return value === null || value === undefined
            ? `${columnName} IS NULL`
            : `${columnName} = ${sqlValue(columnName, value)}`;
        })
        .join(' AND ')})`;
    })
    .join(' OR ');
}

export function recordsToColumnTuples(
  records: DataRecord[],
  columns: string[],
): DataRecordValue[][] {
  return records.map(record => columns.map(column => record[column]));
}

export function areColumnTuplesEqual(
  left: DataRecordValue[][],
  right: DataRecordValue[][],
) {
  return JSON.stringify(left) === JSON.stringify(right);
}
