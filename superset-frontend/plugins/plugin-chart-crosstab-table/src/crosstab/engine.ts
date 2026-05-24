import {
  GenericDataType,
  type DataRecord,
  type DataRecordValue,
} from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';
import type {
  CrosstabBuildOptions,
  CrosstabColumnNode,
  CrosstabEngineResult,
  MetricSemantic,
} from '../types';
import {
  ERR_CROSSTAB_MISSING_SQL_SUMMARY,
  getRequiredSummaryValue,
} from '../plugin/summaryResults';
import { buildColumnTuples, ERR_COLUMN_LIMIT } from './domain';
import { encodeTuple } from './keys';
import { addNumeric } from './totals';

export const CROSSTAB_ROW_KEY = '__crosstab_row_key';
export const CROSSTAB_ROW_LABEL = '__crosstab_row_label';
export const CROSSTAB_ROW_PATH = '__crosstab_row_path';
export const CROSSTAB_ROW_LEVEL = '__crosstab_row_level';
export const CROSSTAB_ROW_TYPE = '__crosstab_row_type';
export const CROSSTAB_TOTAL_COLUMN_ID = '__crosstab_total';
export const CROSSTAB_COLUMN_PREFIX = '__crosstab_col__';
export const ERR_REQUIRED_FIELDS =
  'Crosstab rows, columns, and metrics are required.';
export const ERR_RESERVED_FIELD =
  'Crosstab field names cannot use reserved generated column identifiers.';
export const ERR_DUPLICATE_FIELD =
  'Crosstab row, column, and metric field names must be unique within each area.';
export const ERR_CROSSTAB_MIXED_GRAND_TOTAL_SEMANTICS =
  'Crosstab grand total requires one metric semantic.';

const RESERVED_FIELD_IDS = new Set([
  CROSSTAB_ROW_KEY,
  CROSSTAB_ROW_LABEL,
  CROSSTAB_ROW_PATH,
  CROSSTAB_ROW_LEVEL,
  CROSSTAB_ROW_TYPE,
  CROSSTAB_TOTAL_COLUMN_ID,
]);

function metricColumnId(tuple: unknown[], metric: string) {
  return `${CROSSTAB_COLUMN_PREFIX}${encodeTuple(tuple)}__metric__${metric}`;
}

function columnSubtotalId(tuple: unknown[], metric: string) {
  return `${CROSSTAB_COLUMN_PREFIX}${encodeTuple(tuple)}__subtotal__${metric}`;
}

const DATE_FIELD_PATTERN =
  /(^|_)(date|dttm|time|datetime|timestamp)($|_)|日期|时间/i;

function isDateField(field?: string) {
  return field !== undefined && DATE_FIELD_PATTERN.test(field);
}

function formatDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const absValue = Math.abs(value);
    const timestamp =
      absValue >= 1_000_000_000_000
        ? value
        : absValue >= 1_000_000_000
          ? value * 1000
          : undefined;

    if (timestamp !== undefined) {
      const date = new Date(timestamp);

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  if (typeof value === 'string') {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return undefined;
}

function tupleLabel(value: unknown, field?: string) {
  if (isDateField(field)) {
    const formattedDate = formatDateValue(value);

    if (formattedDate !== undefined) {
      return formattedDate;
    }
  }

  return String(value ?? '');
}

export function encodeCrosstabRowPath(path: string[]) {
  return JSON.stringify(path);
}

export function decodeCrosstabRowPath(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('Invalid crosstab row path.');
  }

  const path = JSON.parse(value);
  if (!Array.isArray(path) || path.some(item => typeof item !== 'string')) {
    throw new Error('Invalid crosstab row path.');
  }

  return path;
}

export function buildColumnTree(
  columnTuples: unknown[][],
  columnFields: string[],
  metricFields: string[],
  fieldLabelsOrShowColumnSubtotals: Record<string, string> | boolean = {},
  showColumnSubtotals = false,
): CrosstabColumnNode[] {
  const fieldLabels =
    typeof fieldLabelsOrShowColumnSubtotals === 'boolean'
      ? {}
      : fieldLabelsOrShowColumnSubtotals;
  const shouldShowColumnSubtotals =
    typeof fieldLabelsOrShowColumnSubtotals === 'boolean'
      ? fieldLabelsOrShowColumnSubtotals
      : showColumnSubtotals;
  const roots: CrosstabColumnNode[] = [];

  columnTuples.forEach(tuple => {
    let siblings = roots;
    let leafNode: CrosstabColumnNode | undefined;

    tuple.forEach((value, index) => {
      const id = encodeTuple(tuple.slice(0, index + 1));
      let node = siblings.find(child => child.id === id);

      if (!node) {
        node = {
          id,
          label: tupleLabel(value, columnFields[index]),
          children: [],
        };
        siblings.push(node);
      }

      leafNode = node;
      siblings = node.children ?? [];
    });

    if (metricFields.length === 1 && leafNode) {
      const [metric] = metricFields;
      leafNode.field = metricColumnId(tuple, metric);
      leafNode.metric = metric;
      delete leafNode.children;
    } else {
      siblings.push(
        ...metricFields.map(metric => ({
          id: metricColumnId(tuple, metric),
          label: fieldLabels[metric] ?? metric,
          field: metricColumnId(tuple, metric),
          metric,
        })),
      );
    }
  });

  if (shouldShowColumnSubtotals && columnTuples.length > 0) {
    const subtotalNodeIds = new Set<string>();
    const findNode = (
      siblings: CrosstabColumnNode[],
      id: string,
    ): CrosstabColumnNode | undefined => {
      for (const sibling of siblings) {
        if (sibling.id === id) {
          return sibling;
        }

        const node = findNode(sibling.children ?? [], id);
        if (node) {
          return node;
        }
      }

      return undefined;
    };
    const addSubtotal = (prefix: unknown[]) => {
      const id = encodeTuple(prefix);
      const subtotalNodeId = `${id}__subtotal`;
      const node = findNode(roots, id);

      if (!node?.children?.length || subtotalNodeIds.has(subtotalNodeId)) {
        return;
      }

      subtotalNodeIds.add(subtotalNodeId);
      if (metricFields.length === 1) {
        const [metric] = metricFields;

        node.children.push({
          id: subtotalNodeId,
          label: 'Subtotal',
          field: columnSubtotalId(prefix, metric),
          metric,
        });

        return;
      }

      node.children.push({
        id: subtotalNodeId,
        label: 'Subtotal',
        children: metricFields.map(metric => ({
          id: columnSubtotalId(prefix, metric),
          label: fieldLabels[metric] ?? metric,
          field: columnSubtotalId(prefix, metric),
          metric,
        })),
      });
    };

    columnTuples.forEach(tuple => {
      for (let depth = 1; depth < tuple.length; depth += 1) {
        addSubtotal(tuple.slice(0, depth));
      }
    });
  }

  return roots;
}

function buildRowKey(record: DataRecord, rowFields: string[]) {
  return encodeTuple(rowFields.map(field => record[field]));
}

function buildRow(record: DataRecord, rowFields: string[], rowKey: string) {
  const rowPath = rowFields.map(field => tupleLabel(record[field], field));

  return rowFields.reduce<DataRecord>(
    (row, field) => ({
      ...row,
      [field]: record[field],
    }),
    {
      [CROSSTAB_ROW_KEY]: rowKey,
      [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(rowPath),
      [CROSSTAB_ROW_LEVEL]: rowFields.length - 1,
      [CROSSTAB_ROW_TYPE]: 'leaf',
      [CROSSTAB_ROW_LABEL]: rowPath[rowPath.length - 1],
    },
  );
}

function buildPrefixKey(row: DataRecord, rowFields: string[], depth: number) {
  return encodeTuple(rowFields.slice(0, depth).map(field => row[field]));
}

function buildGroupRows(
  leafRows: DataRecord[],
  rowFields: string[],
  columnTuples: unknown[][],
  metricFields: string[],
  showColumnTotals: boolean,
  showColumnSubtotals: boolean,
  options: CrosstabBuildOptions,
) {
  if (rowFields.length < 2) {
    return new Map<string, DataRecord>();
  }

  const generatedColumnIds = columnTuples.flatMap(tuple =>
    metricFields.map(metric => metricColumnId(tuple, metric)),
  );
  const subtotalColumnIds = showColumnSubtotals
    ? Array.from(
        new Set(
          columnTuples.flatMap(tuple =>
            tuple
              .slice(0, -1)
              .flatMap((_, index) =>
                metricFields.map(metric =>
                  columnSubtotalId(tuple.slice(0, index + 1), metric),
                ),
              ),
          ),
        ),
      )
    : [];
  const valueColumnIds = [...generatedColumnIds, ...subtotalColumnIds];

  return leafRows.reduce<Map<string, DataRecord>>((groups, row) => {
    const path = decodeCrosstabRowPath(row[CROSSTAB_ROW_PATH]);

    for (let depth = 1; depth < rowFields.length; depth += 1) {
      const groupKey = buildPrefixKey(row, rowFields, depth);
      const current =
        groups.get(groupKey) ??
        rowFields.reduce<DataRecord>(
          (groupRow, field, index) => ({
            ...groupRow,
            [field]: index < depth ? row[field] : null,
          }),
          {
            [CROSSTAB_ROW_KEY]: groupKey,
            [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(path.slice(0, depth)),
            [CROSSTAB_ROW_LEVEL]: depth - 1,
            [CROSSTAB_ROW_TYPE]: 'group',
            [CROSSTAB_ROW_LABEL]: path[depth - 1],
          },
        );

      const rowLookupFields = rowFields.slice(0, depth);
      const nextGeneratedValues = columnTuples.reduce<DataRecord>(
        (groupRow, tuple) =>
          metricFields.reduce<DataRecord>((metricRow, metric) => {
            const columnId = metricColumnId(tuple, metric);
            const sqlValue = getRowSqlSummaryValue({
              row: current,
              rowLookupFields,
              columnValues: tuple,
              metric,
              options,
              map: options.summaryValues?.rowSubtotalCells,
            });

            return {
              ...metricRow,
              [columnId]:
                sqlValue !== undefined
                  ? sqlValue
                  : addNumeric(metricRow[columnId], row[columnId]),
            };
          }, groupRow),
        current,
      );
      const next = showColumnSubtotals
        ? addColumnSubtotalsToRow(
            nextGeneratedValues,
            columnTuples,
            metricFields,
            options,
            rowLookupFields,
          )
        : nextGeneratedValues;
      const sqlTotal =
        showColumnTotals && metricFields.length === 1
          ? getRowSqlSummaryValue({
              row: current,
              rowLookupFields,
              columnValues: [],
              metric: metricFields[0],
              options,
              map: options.summaryValues?.rowSubtotalTotal,
            })
          : undefined;

      groups.set(
        groupKey,
        showColumnTotals ? addRowTotal(next, valueColumnIds, sqlTotal) : next,
      );
    }

    return groups;
  }, new Map<string, DataRecord>());
}

function assertUniqueFields(fields: string[]) {
  if (new Set(fields).size !== fields.length) {
    throw new Error(ERR_DUPLICATE_FIELD);
  }
}

function assertNoReservedFields(fields: string[]) {
  if (
    fields.some(
      field =>
        RESERVED_FIELD_IDS.has(field) ||
        field.startsWith(CROSSTAB_COLUMN_PREFIX),
    )
  ) {
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

function addMissingGeneratedColumns(row: DataRecord, columnIds: string[]) {
  return columnIds.reduce<DataRecord>(
    (nextRow, columnId) =>
      columnId in nextRow ? nextRow : { ...nextRow, [columnId]: null },
    row,
  );
}

function addColumnSubtotalsToRow(
  row: DataRecord,
  columnTuples: unknown[][],
  metricFields: string[],
  options?: CrosstabBuildOptions,
  rowLookupFields?: string[],
) {
  return columnTuples.reduce<DataRecord>(
    (nextRow, tuple) =>
      tuple.slice(0, -1).reduce<DataRecord>((rowWithSubtotal, _, index) => {
        const prefix = tuple.slice(0, index + 1);

        return metricFields.reduce<DataRecord>((subtotalRow, metric) => {
          const subtotalId = columnSubtotalId(prefix, metric);
          const sqlValue =
            options && rowLookupFields
              ? getRowSqlSummaryValue({
                  row,
                  rowLookupFields,
                  columnValues: prefix,
                  metric,
                  options,
                  map:
                    rowLookupFields.length === options.rowFields.length
                      ? options.summaryValues?.columnSubtotalCells
                      : options.summaryValues?.rowColumnSubtotalCells,
                })
              : undefined;

          return {
            ...subtotalRow,
            [subtotalId]:
              sqlValue !== undefined
                ? sqlValue
                : addNumeric(
                    subtotalRow[subtotalId],
                    nextRow[metricColumnId(tuple, metric)],
                  ),
          };
        }, rowWithSubtotal);
      }, nextRow),
    row,
  );
}

function addRowTotal(
  row: DataRecord,
  columnIds: string[],
  injectedTotal?: number | null,
) {
  return {
    ...row,
    [CROSSTAB_TOTAL_COLUMN_ID]:
      injectedTotal !== undefined
        ? injectedTotal
        : columnIds.reduce<number | null>(
            (total, columnId) => addNumeric(total, row[columnId]),
            null,
          ),
  };
}

function isSqlSemantic(semantic: MetricSemantic) {
  return (
    semantic === 'ratio' || semantic === 'average' || semantic === 'distinct'
  );
}

function normalizeGrandTotalSemantic(semantic: MetricSemantic) {
  return semantic === 'unknown' ? 'additive' : semantic;
}

function getRowSqlSummaryValue({
  row,
  rowLookupFields,
  columnValues,
  metric,
  options,
  map,
}: {
  row: DataRecord;
  rowLookupFields: string[];
  columnValues: unknown[];
  metric: string;
  options: CrosstabBuildOptions;
  map?: Map<string, number | null>;
}): number | null | undefined {
  if (map) {
    return getRequiredSummaryValue(map, {
      rowValues: rowLookupFields.map(field => row[field]),
      columnValues: columnValues as DataRecordValue[],
      metric,
    });
  }

  const semantic = options.resolveSemantic?.({ row, metric }) ?? 'additive';

  if (!isSqlSemantic(semantic)) {
    return undefined;
  }

  throw new Error(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
}

function getColumnSqlSemantic(
  leafRows: DataRecord[],
  metric: string,
  options: CrosstabBuildOptions,
) {
  if (!options.resolveSemantic) {
    return undefined;
  }

  const semantics = new Set(
    leafRows.map(row =>
      normalizeGrandTotalSemantic(
        options.resolveSemantic?.({ row, metric }) ?? 'additive',
      ),
    ),
  );

  if (semantics.size > 1) {
    throw new Error(ERR_CROSSTAB_MIXED_GRAND_TOTAL_SEMANTICS);
  }

  const [semantic] = Array.from(semantics);

  return semantic && isSqlSemantic(semantic) ? semantic : undefined;
}

function getColumnSqlSummaryValue({
  leafRows,
  columnValues,
  metric,
  options,
  map,
}: {
  leafRows: DataRecord[];
  columnValues: unknown[];
  metric: string;
  options: CrosstabBuildOptions;
  map?: Map<string, number | null>;
}): number | null | undefined {
  if (map) {
    return getRequiredSummaryValue(map, {
      rowValues: [],
      columnValues: columnValues as DataRecordValue[],
      metric,
    });
  }

  if (getColumnSqlSemantic(leafRows, metric, options)) {
    throw new Error(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  }

  return undefined;
}

function getSqlRowTotal(
  row: DataRecord,
  options: CrosstabBuildOptions,
): number | null | undefined {
  if (options.metricFields.length !== 1) {
    return undefined;
  }

  const [metric] = options.metricFields;

  if (options.summaryValues?.rowTotal) {
    return getRequiredSummaryValue(options.summaryValues.rowTotal, {
      rowValues: options.rowFields.map(field => row[field]),
      columnValues: [],
      metric,
    });
  }

  const semantic = options.resolveSemantic?.({ row, metric }) ?? 'additive';

  if (!isSqlSemantic(semantic)) {
    return undefined;
  }

  throw new Error(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
}

function getSqlGrandTotal(
  leafRows: DataRecord[],
  options: CrosstabBuildOptions,
): number | null | undefined {
  if (options.metricFields.length !== 1) {
    return undefined;
  }

  const [metric] = options.metricFields;

  if (options.summaryValues?.grandTotal) {
    return getRequiredSummaryValue(options.summaryValues.grandTotal, {
      rowValues: [],
      columnValues: [],
      metric,
    });
  }

  if (!options.resolveSemantic) {
    return undefined;
  }

  const { resolveSemantic } = options;
  const semantics = new Set(
    leafRows.map(row =>
      normalizeGrandTotalSemantic(resolveSemantic({ row, metric })),
    ),
  );

  if (semantics.size > 1) {
    throw new Error(ERR_CROSSTAB_MIXED_GRAND_TOTAL_SEMANTICS);
  }

  const [semantic] = Array.from(semantics);

  if (!semantic || !isSqlSemantic(semantic)) {
    return undefined;
  }

  throw new Error(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
}

function buildSubtotalRows(
  leafRows: DataRecord[],
  rowFields: string[],
  columnTuples: unknown[][],
  metricFields: string[],
  showColumnTotals: boolean,
  showColumnSubtotals: boolean,
  options: CrosstabBuildOptions,
  rowSubtotalDepths?: number[],
) {
  if (rowFields.length < 2) {
    return new Map<string, DataRecord>();
  }

  const generatedColumnIds = columnTuples.flatMap(tuple =>
    metricFields.map(metric => metricColumnId(tuple, metric)),
  );
  const subtotalColumnIds = showColumnSubtotals
    ? Array.from(
        new Set(
          columnTuples.flatMap(tuple =>
            tuple
              .slice(0, -1)
              .flatMap((_, index) =>
                metricFields.map(metric =>
                  columnSubtotalId(tuple.slice(0, index + 1), metric),
                ),
              ),
          ),
        ),
      )
    : [];
  const valueColumnIds = [...generatedColumnIds, ...subtotalColumnIds];
  const subtotals = new Map<string, DataRecord>();
  const subtotalDepths = new Set(
    rowSubtotalDepths ??
      Array.from({ length: rowFields.length - 1 }, (_, index) => index + 1),
  );

  leafRows.forEach(row => {
    const path = decodeCrosstabRowPath(row[CROSSTAB_ROW_PATH]);

    for (let depth = 1; depth < rowFields.length; depth += 1) {
      if (!subtotalDepths.has(depth)) {
        continue;
      }

      const subtotalPath = [...path.slice(0, depth), 'Subtotal'];
      const subtotalKey = `${encodeTuple(
        rowFields.slice(0, depth).map(field => row[field]),
      )}__subtotal`;
      const current =
        subtotals.get(subtotalKey) ??
        rowFields.reduce<DataRecord>(
          (subtotalRow, field, index) => ({
            ...subtotalRow,
            [field]: index < depth ? row[field] : null,
          }),
          {
            [CROSSTAB_ROW_KEY]: subtotalKey,
            [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(subtotalPath),
            [CROSSTAB_ROW_LEVEL]: depth,
            [CROSSTAB_ROW_TYPE]: 'subtotal',
            [CROSSTAB_ROW_LABEL]: 'Subtotal',
          },
        );

      const rowLookupFields = rowFields.slice(0, depth);
      const nextGeneratedValues = columnTuples.reduce<DataRecord>(
        (subtotalRow, tuple) =>
          metricFields.reduce<DataRecord>((metricRow, metric) => {
            const columnId = metricColumnId(tuple, metric);
            const sqlValue = getRowSqlSummaryValue({
              row: current,
              rowLookupFields,
              columnValues: tuple,
              metric,
              options,
              map: options.summaryValues?.rowSubtotalCells,
            });

            return {
              ...metricRow,
              [columnId]:
                sqlValue !== undefined
                  ? sqlValue
                  : addNumeric(metricRow[columnId], row[columnId]),
            };
          }, subtotalRow),
        current,
      );
      const next = showColumnSubtotals
        ? addColumnSubtotalsToRow(
            nextGeneratedValues,
            columnTuples,
            metricFields,
            options,
            rowLookupFields,
          )
        : nextGeneratedValues;
      const sqlTotal =
        showColumnTotals && metricFields.length === 1
          ? getRowSqlSummaryValue({
              row: current,
              rowLookupFields,
              columnValues: [],
              metric: metricFields[0],
              options,
              map: options.summaryValues?.rowSubtotalTotal,
            })
          : undefined;

      subtotals.set(
        subtotalKey,
        showColumnTotals ? addRowTotal(next, valueColumnIds, sqlTotal) : next,
      );
    }
  });

  return subtotals;
}

type RowTreeNode = {
  children: Map<string, RowTreeNode>;
  leaves: DataRecord[];
  value?: unknown;
};

function getOrCreateTreeNode(parent: RowTreeNode, key: string, value: unknown) {
  const node = parent.children.get(key);

  if (node) {
    return node;
  }

  const nextNode = {
    children: new Map<string, RowTreeNode>(),
    leaves: [],
    value,
  };
  parent.children.set(key, nextNode);
  return nextNode;
}

function orderHierarchicalRows(
  leafRows: DataRecord[],
  groupRows: Map<string, DataRecord>,
  subtotalRows: Map<string, DataRecord>,
  grandTotalRows: DataRecord[],
  rowFields: string[],
) {
  if (rowFields.length < 2) {
    return [...leafRows, ...grandTotalRows];
  }

  const root: RowTreeNode = {
    children: new Map<string, RowTreeNode>(),
    leaves: [],
  };

  leafRows.forEach(row => {
    let current = root;

    rowFields.forEach(field => {
      current = getOrCreateTreeNode(
        current,
        encodeTuple([row[field]]),
        row[field],
      );
    });

    current.leaves.push(row);
  });

  const rows: DataRecord[] = [];
  const visit = (node: RowTreeNode, prefixValues: unknown[], depth: number) => {
    if (depth > 0 && depth < rowFields.length) {
      const groupKey = encodeTuple(prefixValues);
      const groupRow = groupRows.get(groupKey);

      if (groupRow) {
        rows.push(groupRow);
      }
    }

    if (depth === rowFields.length) {
      rows.push(...node.leaves);
      return;
    }

    node.children.forEach(childNode => {
      visit(childNode, [...prefixValues, childNode.value], depth + 1);
    });

    if (depth > 0 && depth < rowFields.length) {
      const subtotalRow = subtotalRows.get(
        `${encodeTuple(prefixValues)}__subtotal`,
      );

      if (subtotalRow) {
        rows.push(subtotalRow);
      }
    }
  };

  visit(root, [], 0);

  return [...rows, ...grandTotalRows];
}

function buildGrandTotalRow(
  leafRows: DataRecord[],
  columnTuples: unknown[][],
  metricFields: string[],
  showColumnTotals: boolean,
  options: CrosstabBuildOptions,
) {
  const generatedColumnIds = columnTuples.flatMap(tuple =>
    metricFields.map(metric => metricColumnId(tuple, metric)),
  );
  const rowWithGeneratedValues = columnTuples.reduce<DataRecord>(
    (totalRow, tuple) =>
      metricFields.reduce<DataRecord>((metricRow, metric) => {
        const columnId = metricColumnId(tuple, metric);
        const sqlValue = getColumnSqlSummaryValue({
          leafRows,
          columnValues: tuple,
          metric,
          options,
          map: options.summaryValues?.columnTotal,
        });

        return {
          ...metricRow,
          [columnId]:
            sqlValue !== undefined
              ? sqlValue
              : leafRows.reduce<number | null>(
                  (total, leafRow) => addNumeric(total, leafRow[columnId]),
                  null,
                ),
        };
      }, totalRow),
    {
      [CROSSTAB_ROW_KEY]: '__crosstab_grand_total',
      [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['Grand total']),
      [CROSSTAB_ROW_LEVEL]: 0,
      [CROSSTAB_ROW_TYPE]: 'grand_total',
      [CROSSTAB_ROW_LABEL]: 'Grand total',
    },
  );
  const row = options.showColumnSubtotals
    ? columnTuples.reduce<DataRecord>(
        (nextRow, tuple) =>
          tuple.slice(0, -1).reduce<DataRecord>((subtotalRow, _, index) => {
            const prefix = tuple.slice(0, index + 1);

            return metricFields.reduce<DataRecord>((metricRow, metric) => {
              const subtotalId = columnSubtotalId(prefix, metric);
              const sqlValue = getColumnSqlSummaryValue({
                leafRows,
                columnValues: prefix,
                metric,
                options,
                map: options.summaryValues?.columnSubtotalTotal,
              });

              return {
                ...metricRow,
                [subtotalId]:
                  sqlValue !== undefined
                    ? sqlValue
                    : addNumeric(
                        metricRow[subtotalId],
                        nextRow[metricColumnId(tuple, metric)],
                      ),
              };
            }, subtotalRow);
          }, nextRow),
        rowWithGeneratedValues,
      )
    : rowWithGeneratedValues;
  const subtotalColumnIds = options.showColumnSubtotals
    ? Array.from(
        new Set(
          columnTuples.flatMap(tuple =>
            tuple
              .slice(0, -1)
              .flatMap((_, index) =>
                metricFields.map(metric =>
                  columnSubtotalId(tuple.slice(0, index + 1), metric),
                ),
              ),
          ),
        ),
      )
    : [];
  const valueColumnIds = [...generatedColumnIds, ...subtotalColumnIds];

  return showColumnTotals
    ? addRowTotal(row, valueColumnIds, getSqlGrandTotal(leafRows, options))
    : row;
}

export function buildCrosstab(
  records: DataRecord[],
  options: CrosstabBuildOptions,
): CrosstabEngineResult {
  const {
    fieldLabels = {},
    metricFields,
    rowFields,
    columnFields,
    totalLabel = 'Total',
  } = options;
  assertBuildOptions(options);

  const orderedRecords = options.rowComparator
    ? [...records].sort(options.rowComparator)
    : [...records];
  const columnRecords = options.columnComparator
    ? [...records].sort(options.columnComparator)
    : orderedRecords;
  const columnTuples = buildColumnTuples(
    columnRecords,
    columnFields,
    options.maxGeneratedColumns,
    metricFields.length,
    options.columnComparator,
  );
  const generatedColumnIds = columnTuples.flatMap(tuple =>
    metricFields.map(metric => metricColumnId(tuple, metric)),
  );
  const columnSubtotalIds = options.showColumnSubtotals
    ? columnTuples.flatMap(tuple =>
        tuple
          .slice(0, -1)
          .flatMap((_, index) =>
            metricFields.map(metric =>
              columnSubtotalId(tuple.slice(0, index + 1), metric),
            ),
          ),
      )
    : [];
  const subtotalColumnIds = Array.from(new Set(columnSubtotalIds));
  const valueColumnIds = [...generatedColumnIds, ...subtotalColumnIds];
  const rows = new Map<string, DataRecord>();

  orderedRecords.forEach(record => {
    const rowKey = buildRowKey(record, rowFields);
    const row = rows.get(rowKey) ?? buildRow(record, rowFields, rowKey);
    const columnTuple = columnFields.map(field => record[field]);
    const nextRow = metricFields.reduce<DataRecord>((updatedRow, metric) => {
      const columnId = metricColumnId(columnTuple, metric);

      return {
        ...updatedRow,
        [columnId]: addNumeric(updatedRow[columnId], record[metric]),
      };
    }, row);

    rows.set(rowKey, nextRow);
  });

  const leafRows = Array.from(rows.values()).map(row => {
    const rowWithGeneratedColumns = addMissingGeneratedColumns(
      row,
      generatedColumnIds,
    );
    const rowWithSubtotals = options.showColumnSubtotals
      ? addColumnSubtotalsToRow(
          rowWithGeneratedColumns,
          columnTuples,
          metricFields,
          options,
          rowFields,
        )
      : rowWithGeneratedColumns;
    const completeRow = addMissingGeneratedColumns(
      rowWithSubtotals,
      valueColumnIds,
    );

    return options.showColumnTotals
      ? addRowTotal(
          completeRow,
          generatedColumnIds,
          getSqlRowTotal(row, options),
        )
      : completeRow;
  });

  const groupRows = buildGroupRows(
    leafRows,
    rowFields,
    columnTuples,
    metricFields,
    options.showColumnTotals,
    options.showColumnSubtotals,
    options,
  );
  const subtotalRows = options.showRowSubtotals
    ? buildSubtotalRows(
        leafRows,
        rowFields,
        columnTuples,
        metricFields,
        options.showColumnTotals,
        options.showColumnSubtotals,
        options,
        options.rowSubtotalDepths,
      )
    : new Map<string, DataRecord>();
  const grandTotalRows = options.showRowTotals
    ? [
        buildGrandTotalRow(
          leafRows,
          columnTuples,
          metricFields,
          options.showColumnTotals,
          options,
        ),
      ]
    : [];

  return {
    rowData: orderHierarchicalRows(
      leafRows,
      groupRows,
      subtotalRows,
      grandTotalRows,
      rowFields,
    ),
    generatedColumnIds,
    columnTree: buildColumnTree(
      columnTuples,
      columnFields,
      metricFields,
      fieldLabels,
      options.showColumnSubtotals,
    ),
    columns: [
      ...rowFields.map(field =>
        columnMeta(field, fieldLabels[field] ?? field, GenericDataType.String),
      ),
      ...generatedColumnIds.map(columnId => ({
        ...columnMeta(columnId, columnId, GenericDataType.Numeric, true),
      })),
      ...subtotalColumnIds.map(columnId => ({
        ...columnMeta(columnId, columnId, GenericDataType.Numeric, true),
      })),
      ...(options.showColumnTotals
        ? [
            columnMeta(
              CROSSTAB_TOTAL_COLUMN_ID,
              totalLabel,
              GenericDataType.Numeric,
              true,
            ),
          ]
        : []),
    ],
  };
}
