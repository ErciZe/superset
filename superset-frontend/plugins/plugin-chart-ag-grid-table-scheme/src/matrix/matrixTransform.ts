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
  GenericDataType,
  type DataRecord,
  type DataRecordValue,
} from '@superset-ui/core';
import type { DataColumnMeta } from '../../../plugin-chart-ag-grid-table/src/types';

import type {
  MatrixCalculation,
  MatrixTransformConfig,
  MatrixTransformResult,
} from './types';

export const MATRIX_TOTAL_COL_ID = '__matrix_total';
export const MATRIX_COL_PREFIX = '__matrix_col__';

type RowBucket = {
  rowValues: DataRecord;
  rowLabel: string;
  cells: Map<string, number | null>;
  rowSortValue?: DataRecordValue;
  unit?: DataRecordValue;
};

type ColumnTuple = {
  id: string;
  label: string;
  sortValues: Array<DataRecordValue | undefined>;
};

type CanonicalDimensionValue = {
  key: string;
  label: string;
};

const SUPPORTED_CALCULATIONS = new Set<MatrixCalculation>([
  'raw',
  'contribution',
  'row_contribution',
  'row_rank',
]);

const serializeDimensionValue = (value: DataRecordValue) => {
  if (value === null) {
    return 'null';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const encodeColumnValue = (value: DataRecordValue) =>
  encodeURIComponent(serializeDimensionValue(value));

const getDimensionTypeTag = (value: DataRecordValue | undefined) => {
  if (value === undefined) {
    return 'u';
  }
  if (value === null) {
    return 'z';
  }
  if (value instanceof Date) {
    return 'd';
  }
  if (typeof value === 'string') {
    return 's';
  }
  if (typeof value === 'number') {
    return 'n';
  }
  if (typeof value === 'boolean') {
    return 'b';
  }
  return 'g';
};

const getCanonicalDimensionValue = (
  value: DataRecordValue | undefined,
): CanonicalDimensionValue => {
  const label =
    value === undefined ? 'undefined' : serializeDimensionValue(value);
  const encodedLabel = encodeURIComponent(label);

  return {
    key: `${getDimensionTypeTag(value)}${encodedLabel.length}:${encodedLabel}`,
    label,
  };
};

const getDimensionLabel = (
  field: string,
  value: DataRecordValue | undefined,
  formatters: MatrixTransformConfig['dimensionLabelFormatters'],
) => {
  if (value === undefined) {
    return 'undefined';
  }
  const formatter = formatters?.[field];
  if (formatter && value !== null) {
    return formatter(value);
  }
  return getCanonicalDimensionValue(value).label;
};

const buildRowKey = (record: DataRecord, fields: string[]) =>
  fields.map(field => getCanonicalDimensionValue(record[field]).key).join('');

const buildRowLabel = (
  record: DataRecord,
  fields: string[],
  formatters: MatrixTransformConfig['dimensionLabelFormatters'],
) =>
  fields
    .map(field => getDimensionLabel(field, record[field], formatters))
    .join(' / ');

const buildColumnTuple = (
  record: DataRecord,
  fields: string[],
  formatters: MatrixTransformConfig['dimensionLabelFormatters'],
): ColumnTuple => {
  const values = fields.map(field => record[field]);
  const encodedValue =
    values.length === 1
      ? typeof values[0] === 'string'
        ? encodeColumnValue(values[0])
        : getCanonicalDimensionValue(values[0]).key
      : values.map(item => getCanonicalDimensionValue(item).key).join('');

  return {
    id: `${MATRIX_COL_PREFIX}${encodedValue}`,
    label: fields
      .map(field => getDimensionLabel(field, record[field], formatters))
      .join(' / '),
    sortValues: values,
  };
};

const toSortableString = (value: DataRecordValue | undefined) =>
  value === undefined ? '' : serializeDimensionValue(value);

const compareRecordValues = (
  left: DataRecordValue | undefined,
  right: DataRecordValue | undefined,
) => {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return toSortableString(left).localeCompare(toSortableString(right));
};

const getMatrixValue = (record: DataRecord, valueField: string) => {
  const value = record[valueField];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Matrix value "${valueField}" must be numeric or null.`);
  }
  return value;
};

const sumCell = (current: number | null | undefined, value: number | null) => {
  if (value === null) {
    return current ?? null;
  }
  return (current ?? 0) + value;
};

const sumNumbers = (values: Array<number | null | undefined>) =>
  values.reduce<number>(
    (sum, value) => sum + (typeof value === 'number' ? value : 0),
    0,
  );

const formatRawValue = (
  value: number | null | undefined,
  unit: DataRecordValue | undefined,
  formatter?: DataColumnMeta['formatter'],
): number | string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (!unit) {
    return value;
  }
  const formattedValue = formatter ? formatter(value) : `${value}`;
  if (unit === '%') {
    return `${formattedValue}%`;
  }
  return formatter ? formattedValue : value;
};

const getDenseRanks = (cells: Map<string, number | null>) => {
  const sortedValues = Array.from(
    new Set(
      Array.from(cells.values()).filter(
        (value): value is number => typeof value === 'number',
      ),
    ),
  ).sort((left, right) => right - left);

  return new Map(sortedValues.map((value, index) => [value, index + 1]));
};

const createColumn = (
  key: string,
  label = key,
  dataType = GenericDataType.String,
  formatter?: DataColumnMeta['formatter'],
): DataColumnMeta => ({
  key,
  label,
  dataType,
  formatter,
  config: {},
});

const assertConsistentBucketValue = (
  fieldName: string,
  rowKey: string,
  currentValue: DataRecordValue | undefined,
  nextValue: DataRecordValue | undefined,
) => {
  if (
    getCanonicalDimensionValue(currentValue).key !==
    getCanonicalDimensionValue(nextValue).key
  ) {
    throw new Error(
      `Matrix ${fieldName} value must be consistent within row ${rowKey}.`,
    );
  }
};

const buildSummaryTotals = (
  summaryRecords: DataRecord[] | undefined,
  rows: string[],
  valueField: string,
) => {
  if (!summaryRecords) {
    return undefined;
  }
  return summaryRecords.reduce((totals, record) => {
    const rowKey = buildRowKey(record, rows);
    if (totals.has(rowKey)) {
      throw new Error(`Matrix summary row is duplicated for key ${rowKey}.`);
    }
    totals.set(rowKey, getMatrixValue(record, valueField));
    return totals;
  }, new Map<string, number | null>());
};

export function matrixTransform(
  records: DataRecord[],
  config: MatrixTransformConfig,
): MatrixTransformResult {
  const {
    rows,
    columns,
    value,
    summaryRecords,
    fieldLabels,
    dimensionLabelFormatters,
    temporalFields = [],
    valueFormatter,
    rowSort,
    rowSortDesc = false,
    unitField,
    showTotal,
    totalPosition,
    calculation,
    maxGeneratedColumns,
  } = config;

  if (!rows.length || !columns.length || !value) {
    throw new Error('Matrix rows, columns, and value are required.');
  }
  if (!SUPPORTED_CALCULATIONS.has(calculation)) {
    throw new Error(`Unsupported matrix calculation: ${calculation}.`);
  }
  if (totalPosition !== 'left' && totalPosition !== 'right') {
    throw new Error(`Unsupported matrix total position: ${totalPosition}.`);
  }
  if (!Number.isInteger(maxGeneratedColumns) || maxGeneratedColumns < 1) {
    throw new Error('Matrix maxGeneratedColumns must be a positive integer.');
  }

  const rowBuckets = new Map<string, RowBucket>();
  const summaryTotals = buildSummaryTotals(summaryRecords, rows, value);
  const generatedColumnIds = new Set<string>();
  const generatedColumnLabels = new Map<string, string>();
  const generatedColumnSortValues = new Map<
    string,
    Array<DataRecordValue | undefined>
  >();
  const temporalFieldSet = new Set(temporalFields);

  records.forEach(record => {
    const rowKey = buildRowKey(record, rows);
    const columnTuple = buildColumnTuple(
      record,
      columns,
      dimensionLabelFormatters,
    );
    const matrixValue = getMatrixValue(record, value);

    if (!rowBuckets.has(rowKey)) {
      rowBuckets.set(rowKey, {
        rowValues: rows.reduce<DataRecord>(
          (row, field) => ({ ...row, [field]: record[field] }),
          {},
        ),
        rowLabel: buildRowLabel(record, rows, dimensionLabelFormatters),
        cells: new Map(),
        rowSortValue: rowSort ? record[rowSort] : undefined,
        unit: unitField ? record[unitField] : undefined,
      });
    }

    const rowBucket = rowBuckets.get(rowKey);
    if (!rowBucket) {
      throw new Error(
        `Matrix row bucket was not initialized for key ${rowKey}.`,
      );
    }
    if (rowSort) {
      assertConsistentBucketValue(
        'rowSort',
        rowBucket.rowLabel,
        rowBucket.rowSortValue,
        record[rowSort],
      );
    }
    if (unitField) {
      assertConsistentBucketValue(
        'unitField',
        rowBucket.rowLabel,
        rowBucket.unit,
        record[unitField],
      );
    }
    generatedColumnIds.add(columnTuple.id);
    generatedColumnLabels.set(columnTuple.id, columnTuple.label);
    generatedColumnSortValues.set(columnTuple.id, columnTuple.sortValues);
    rowBucket.cells.set(
      columnTuple.id,
      sumCell(rowBucket.cells.get(columnTuple.id), matrixValue),
    );
  });

  const sortedGeneratedColumnIds = Array.from(generatedColumnIds).sort(
    (left, right) => {
      const leftValues = generatedColumnSortValues.get(left) ?? [];
      const rightValues = generatedColumnSortValues.get(right) ?? [];
      for (let index = 0; index < columns.length; index += 1) {
        const sortResult = compareRecordValues(
          leftValues[index],
          rightValues[index],
        );
        if (sortResult !== 0) {
          return temporalFieldSet.has(columns[index])
            ? -sortResult
            : sortResult;
        }
      }
      return left.localeCompare(right);
    },
  );
  if (sortedGeneratedColumnIds.length > maxGeneratedColumns) {
    throw new Error(
      `Matrix generated ${sortedGeneratedColumnIds.length} columns, which exceeds the limit of ${maxGeneratedColumns}.`,
    );
  }

  const matrixTotal = sumNumbers(
    Array.from(rowBuckets.values()).flatMap(rowBucket =>
      sortedGeneratedColumnIds.map(columnId => rowBucket.cells.get(columnId)),
    ),
  );
  if (calculation === 'contribution' && matrixTotal === 0) {
    throw new Error('Matrix total must be non-zero for contribution.');
  }

  const sortedRows = Array.from(rowBuckets.values()).sort((left, right) => {
    const compareBySortField = rowSort
      ? compareRecordValues(left.rowSortValue, right.rowSortValue)
      : compareRecordValues(
          buildRowKey(left.rowValues, rows),
          buildRowKey(right.rowValues, rows),
        );
    return rowSortDesc ? -compareBySortField : compareBySortField;
  });

  const data = sortedRows.map(rowBucket => {
    const row: DataRecord = { ...rowBucket.rowValues };
    const rowTotal = sumNumbers(
      sortedGeneratedColumnIds.map(columnId => rowBucket.cells.get(columnId)),
    );
    const rowKey = buildRowKey(rowBucket.rowValues, rows);
    if (summaryTotals && showTotal && calculation === 'raw') {
      if (!summaryTotals.has(rowKey)) {
        throw new Error(
          `Matrix summary total is missing for row ${rowBucket.rowLabel}.`,
        );
      }
    }
    const rawTotal =
      summaryTotals && showTotal && calculation === 'raw'
        ? summaryTotals.get(rowKey)
        : rowTotal;
    if (calculation === 'row_contribution' && rowTotal === 0) {
      throw new Error(
        'Matrix row total must be non-zero for row contribution.',
      );
    }

    if (showTotal) {
      row[MATRIX_TOTAL_COL_ID] =
        calculation === 'raw'
          ? formatRawValue(rawTotal, rowBucket.unit, valueFormatter)
          : rowTotal;
    }

    if (calculation === 'row_rank') {
      const ranks = getDenseRanks(rowBucket.cells);
      sortedGeneratedColumnIds.forEach(columnId => {
        const cell = rowBucket.cells.get(columnId);
        row[columnId] =
          typeof cell === 'number' ? (ranks.get(cell) ?? null) : null;
      });
      return row;
    }

    sortedGeneratedColumnIds.forEach(columnId => {
      const cell = rowBucket.cells.get(columnId);
      if (calculation === 'raw') {
        row[columnId] = formatRawValue(cell, rowBucket.unit, valueFormatter);
      } else if (calculation === 'contribution') {
        row[columnId] = typeof cell === 'number' ? cell / matrixTotal : null;
      } else if (calculation === 'row_contribution') {
        row[columnId] = typeof cell === 'number' ? cell / rowTotal : null;
      }
    });

    return row;
  });

  const rawValueType = unitField
    ? GenericDataType.String
    : GenericDataType.Numeric;
  const rowColumns = rows.map(row =>
    createColumn(row, fieldLabels?.[row] ?? row),
  );
  const generatedColumns = sortedGeneratedColumnIds.map(columnId =>
    createColumn(
      columnId,
      generatedColumnLabels.get(columnId) ?? columnId,
      calculation === 'raw' ? rawValueType : GenericDataType.Numeric,
      calculation === 'raw' && !unitField ? valueFormatter : undefined,
    ),
  );
  const totalColumn = createColumn(
    MATRIX_TOTAL_COL_ID,
    'Total',
    calculation === 'raw' ? rawValueType : GenericDataType.Numeric,
    calculation === 'raw' && !unitField ? valueFormatter : undefined,
  );

  const resultColumns: DataColumnMeta[] = [...rowColumns];
  if (showTotal && totalPosition === 'left') {
    resultColumns.push(totalColumn);
  }
  resultColumns.push(...generatedColumns);
  if (showTotal && totalPosition === 'right') {
    resultColumns.push(totalColumn);
  }

  return {
    data,
    columns: resultColumns,
    generatedColumnIds: sortedGeneratedColumnIds,
  };
}
