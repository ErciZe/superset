import type { DataRecord } from '@superset-ui/core';
import type { CrosstabBuildOptions, CrosstabEngineResult } from '../types';
import { buildColumnTuples } from './domain';
import { encodeTuple } from './keys';
import { addNumeric } from './totals';

export const CROSSTAB_ROW_KEY = '__crosstab_row_key';
export const CROSSTAB_ROW_LABEL = '__crosstab_row_label';
export const CROSSTAB_TOTAL_COLUMN_ID = '__crosstab_total';
export const CROSSTAB_COLUMN_PREFIX = '__crosstab_col__';
export const ERR_REQUIRED_FIELDS =
  'Crosstab rows, columns, and metrics are required.';

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

export function buildCrosstab(
  records: DataRecord[],
  options: CrosstabBuildOptions,
): CrosstabEngineResult {
  const { rowFields, columnFields, metricFields } = options;

  if (!rowFields.length || !columnFields.length || !metricFields.length) {
    throw new Error(ERR_REQUIRED_FIELDS);
  }

  const columnTuples = buildColumnTuples(
    records,
    columnFields,
    options.maxGeneratedColumns,
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
      row[CROSSTAB_TOTAL_COLUMN_ID] = generatedColumnIds.reduce<unknown>(
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
      ...rowFields.map(field => ({ key: field, label: field })),
      ...generatedColumnIds.map(columnId => ({
        key: columnId,
        label: columnId,
      })),
      ...(options.showColumnTotals
        ? [{ key: CROSSTAB_TOTAL_COLUMN_ID, label: 'Total' }]
        : []),
    ],
  };
}
