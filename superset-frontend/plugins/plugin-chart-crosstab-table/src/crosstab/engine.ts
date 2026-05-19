import { GenericDataType, type DataRecord } from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';
import type { CrosstabBuildOptions, CrosstabEngineResult } from '../types';
import { buildColumnTuples, ERR_COLUMN_LIMIT } from './domain';
import { encodeTuple } from './keys';
import { addNumeric } from './totals';

export const CROSSTAB_ROW_KEY = '__crosstab_row_key';
export const CROSSTAB_ROW_LABEL = '__crosstab_row_label';
export const CROSSTAB_TOTAL_COLUMN_ID = '__crosstab_total';
export const CROSSTAB_COLUMN_PREFIX = '__crosstab_col__';
export const ERR_REQUIRED_FIELDS =
  'Crosstab rows, columns, and metrics are required.';
export const ERR_RESERVED_FIELD =
  'Crosstab field names cannot use reserved generated column identifiers.';
export const ERR_DUPLICATE_FIELD =
  'Crosstab row, column, and metric field names must be unique within each area.';

const RESERVED_FIELD_IDS = new Set([
  CROSSTAB_ROW_KEY,
  CROSSTAB_ROW_LABEL,
  CROSSTAB_TOTAL_COLUMN_ID,
]);

function metricColumnId(tuple: unknown[], metric: string) {
  return `${CROSSTAB_COLUMN_PREFIX}${encodeTuple(tuple)}__metric__${metric}`;
}

function buildRowKey(record: DataRecord, rowFields: string[]) {
  return encodeTuple(rowFields.map(field => record[field]));
}

function buildRow(record: DataRecord, rowFields: string[], rowKey: string) {
  return rowFields.reduce<DataRecord>(
    (row, field) => ({
      ...row,
      [field]: record[field],
    }),
    {
      [CROSSTAB_ROW_KEY]: rowKey,
      [CROSSTAB_ROW_LABEL]: String(
        record[rowFields[rowFields.length - 1]] ?? '',
      ),
    },
  );
}

function assertUniqueFields(fields: string[]) {
  if (new Set(fields).size !== fields.length) {
    throw new Error(ERR_DUPLICATE_FIELD);
  }
}

function assertNoReservedFields(fields: string[]) {
  if (fields.some(field => RESERVED_FIELD_IDS.has(field))) {
    throw new Error(ERR_RESERVED_FIELD);
  }
}

function assertBuildOptions(options: CrosstabBuildOptions) {
  const { rowFields, columnFields, metricFields } = options;

  if (!rowFields.length || !columnFields.length || !metricFields.length) {
    throw new Error(ERR_REQUIRED_FIELDS);
  }

  if (
    !Number.isInteger(options.maxGeneratedColumns) ||
    options.maxGeneratedColumns < 1
  ) {
    throw new Error(ERR_COLUMN_LIMIT(1, options.maxGeneratedColumns));
  }

  [rowFields, columnFields, metricFields].forEach(fields => {
    assertUniqueFields(fields);
    assertNoReservedFields(fields);
  });
}

function columnMeta(
  key: string,
  label: string,
  dataType: GenericDataType,
  isMetric = false,
): DataColumnMeta {
  return {
    key,
    label,
    dataType,
    isMetric,
    isNumeric: dataType === GenericDataType.Numeric,
  };
}

export function buildCrosstab(
  records: DataRecord[],
  options: CrosstabBuildOptions,
): CrosstabEngineResult {
  const { rowFields, columnFields, metricFields } = options;
  assertBuildOptions(options);

  const columnTuples = buildColumnTuples(
    records,
    columnFields,
    options.maxGeneratedColumns,
    metricFields.length,
  );
  const generatedColumnIds = columnTuples.flatMap(tuple =>
    metricFields.map(metric => metricColumnId(tuple, metric)),
  );
  const rows = new Map<string, DataRecord>();

  records.forEach(record => {
    const rowKey = buildRowKey(record, rowFields);
    const row = rows.get(rowKey) ?? buildRow(record, rowFields, rowKey);
    const columnTuple = columnFields.map(field => record[field]);

    metricFields.forEach(metric => {
      const columnId = metricColumnId(columnTuple, metric);
      row[columnId] = addNumeric(row[columnId], record[metric]);
    });

    rows.set(rowKey, row);
  });

  const rowData = Array.from(rows.values()).map(row => {
    generatedColumnIds.forEach(columnId => {
      if (!(columnId in row)) {
        row[columnId] = null;
      }
    });

    if (options.showColumnTotals) {
      row[CROSSTAB_TOTAL_COLUMN_ID] = generatedColumnIds.reduce<number | null>(
        (total, columnId) => addNumeric(total, row[columnId]),
        null,
      );
    }

    return row;
  });

  return {
    rowData,
    generatedColumnIds,
    columnTree: [],
    columns: [
      ...rowFields.map(field =>
        columnMeta(field, field, GenericDataType.String),
      ),
      ...generatedColumnIds.map(columnId => ({
        ...columnMeta(columnId, columnId, GenericDataType.Numeric, true),
      })),
      ...(options.showColumnTotals
        ? [
            columnMeta(
              CROSSTAB_TOTAL_COLUMN_ID,
              'Total',
              GenericDataType.Numeric,
              true,
            ),
          ]
        : []),
    ],
  };
}
