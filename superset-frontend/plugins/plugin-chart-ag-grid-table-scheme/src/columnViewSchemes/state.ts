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
import type {
  ColumnSettingGroup,
  ColumnSettingItem,
  ColumnViewColumnState,
  ColumnViewSchemeColumn,
  ColumnViewSchemeState,
  ColumnViewStateOptions,
  SchemeColDef,
} from './types';

export const getColId = (col: SchemeColDef) => col.colId || col.field;

const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return `hash:${hash.toString(16)}`;
};

export const buildColumnSignature = (colDefs: SchemeColDef[]) => {
  const signatureInput = colDefs
    .map(colDef => [getColId(colDef) || '', colDef.headerName || ''])
    .sort(([leftColId, leftHeader], [rightColId, rightHeader]) =>
      `${leftColId}\u0000${leftHeader}`.localeCompare(
        `${rightColId}\u0000${rightHeader}`,
      ),
    )
    .map(([colId, headerName]) => `${colId}:${headerName}`)
    .join('|');

  return hashString(signatureInput);
};

const buildColDefById = (colDefs: SchemeColDef[]) =>
  colDefs.reduce((colDefById, colDef) => {
    const colId = getColId(colDef);

    if (colId) {
      colDefById.set(colId, colDef);
    }

    return colDefById;
  }, new Map<string, SchemeColDef>());

const normalizeText = (value: string) => value.toLowerCase();

const DATE_COLUMN_PATTERNS = [
  'date',
  'time',
  '日期',
  '时间',
  'day',
  'week',
  'month',
  'year',
];

const METRIC_COLUMN_PATTERNS = [
  'amount',
  'cost',
  'fee',
  'profit',
  'gross',
  'sales',
  'volume',
  'quantity',
  'ratio',
  'rate',
  'discount',
  'refund',
  'income',
  '金额',
  '成本',
  '费用',
  '利润',
  '销量',
  '销售',
  '%',
];

const BASIC_COLUMN_PATTERNS = [
  'sku',
  'msku',
  'asin',
  'shop',
  'store',
  'country',
  'category',
  'dimension',
  'name',
  'key',
  'id',
  '维度',
  '店铺',
  '国家',
  '品类',
  '父体',
  '本地',
  '编码',
  '排序',
  '项',
  '单位',
  '币种',
];

const matchesAnyPattern = (value: string, patterns: string[]) =>
  patterns.some(pattern => value.includes(pattern));

export const inferColumnSettingGroup = (
  colDef: SchemeColDef,
): ColumnSettingGroup => {
  const source = normalizeText(
    [getColId(colDef), colDef.field, colDef.headerName]
      .filter(Boolean)
      .join(' '),
  );
  const dataType = normalizeText(
    String(
      (colDef as SchemeColDef & { dataType?: string; cellDataType?: string })
        .dataType ||
        (colDef as SchemeColDef & { dataType?: string; cellDataType?: string })
          .cellDataType ||
        '',
    ),
  );

  if (
    dataType.includes('date') ||
    dataType.includes('time') ||
    matchesAnyPattern(source, DATE_COLUMN_PATTERNS)
  ) {
    return '日期/时间';
  }
  if (
    dataType.includes('number') ||
    dataType.includes('numeric') ||
    matchesAnyPattern(source, METRIC_COLUMN_PATTERNS)
  ) {
    return '指标数据';
  }
  if (
    dataType.includes('string') ||
    dataType.includes('text') ||
    matchesAnyPattern(source, BASIC_COLUMN_PATTERNS)
  ) {
    return '基础信息';
  }

  return '其他';
};

export const buildColumnSettingItems = (
  columnState: ColumnViewColumnState[],
  colDefs: SchemeColDef[],
): ColumnSettingItem[] => {
  const colDefById = buildColDefById(colDefs);
  const configuredColIds = colDefs
    .map(getColId)
    .filter((colId): colId is string => Boolean(colId));
  const configuredColIdSet = new Set(configuredColIds);
  const columnStateById = new Map(
    columnState
      .filter(state => configuredColIdSet.has(state.colId))
      .map(state => [state.colId, state]),
  );
  const orderedColIds = [
    ...columnState
      .map(state => state.colId)
      .filter(colId => configuredColIdSet.has(colId)),
    ...configuredColIds.filter(colId => !columnStateById.has(colId)),
  ];

  return orderedColIds.map(colId => {
    const colDef = colDefById.get(colId);
    const state = columnStateById.get(colId);

    return {
      colId,
      label: colDef?.headerName || colDef?.field || colId,
      group: colDef ? inferColumnSettingGroup(colDef) : '其他',
      visible: state?.hide !== true,
      pinned: state?.pinned === true || state?.pinned === 'left',
    };
  });
};

export const buildDefaultColumnSettingItems = (colDefs: SchemeColDef[]) =>
  buildColumnSettingItems([], colDefs);

export const buildColumnStateFromSettings = (
  currentColumnState: ColumnViewColumnState[],
  settings: ColumnSettingItem[],
  colDefs: SchemeColDef[],
  options: ColumnViewStateOptions = { includeSort: true },
): ColumnViewColumnState[] => {
  const configuredColIds = new Set(
    colDefs.map(getColId).filter((colId): colId is string => Boolean(colId)),
  );
  const currentStateById = new Map(
    currentColumnState
      .filter(state => configuredColIds.has(state.colId))
      .map(state => [state.colId, state]),
  );
  const selectedColIds = new Set(settings.map(setting => setting.colId));
  const orderedSettings = settings.filter(setting =>
    configuredColIds.has(setting.colId),
  );

  colDefs.forEach(colDef => {
    const colId = getColId(colDef);
    if (colId && configuredColIds.has(colId) && !selectedColIds.has(colId)) {
      orderedSettings.push({
        colId,
        label: colDef.headerName || colDef.field || colId,
        group: inferColumnSettingGroup(colDef),
        visible: true,
        pinned: false,
      });
    }
  });

  return orderedSettings.map(setting => {
    const currentState = currentStateById.get(setting.colId);
    return removeUndefinedValues({
      ...pickColumnViewState(
        {
          colId: setting.colId,
          width: currentState?.width,
          pinned: setting.pinned ? 'left' : null,
          hide: !setting.visible,
          sort: currentState?.sort,
          sortIndex: currentState?.sortIndex,
        },
        options,
      ),
      pinned: setting.pinned ? 'left' : null,
      hide: !setting.visible,
    });
  });
};

const removeUndefinedValues = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;

const compactColumnState = (
  columnState: ColumnViewColumnState[],
  colDefs: SchemeColDef[],
  options: ColumnViewStateOptions,
): ColumnViewSchemeColumn[] => {
  const colDefById = buildColDefById(colDefs);

  return columnState.map(state => {
    const colDef = colDefById.get(state.colId);

    return removeUndefinedValues({
      colId: state.colId,
      field: colDef?.field,
      headerName: colDef?.headerName,
      hide: state.hide,
      width: state.width,
      pinned: state.pinned,
      ...(options.includeSort && {
        sort: state.sort,
        sortIndex: state.sortIndex,
      }),
    });
  });
};

const pickColumnViewState = (
  state: ColumnViewColumnState,
  options: ColumnViewStateOptions,
): ColumnViewColumnState =>
  removeUndefinedValues({
    colId: state.colId,
    hide: state.hide,
    width: state.width,
    pinned: state.pinned,
    ...(options.includeSort && {
      sort: state.sort,
      sortIndex: state.sortIndex,
    }),
  });

export const captureColumnViewState = (
  columnState: ColumnViewColumnState[],
  colDefs: SchemeColDef[],
  options: ColumnViewStateOptions = { includeSort: true },
): ColumnViewSchemeState => ({
  state_version: 1,
  viz_type: 'ag-grid-table-scheme',
  state_type: 'column_view',
  column_signature: buildColumnSignature(colDefs),
  columns: compactColumnState(columnState, colDefs, options),
  raw_column_state: columnState.map(state =>
    pickColumnViewState(state, options),
  ),
  meta: {
    saved_at: new Date().toISOString(),
  },
});

export const reconcileColumnState = (
  savedState: ColumnViewSchemeState,
  colDefs: SchemeColDef[],
  options: ColumnViewStateOptions = { includeSort: true },
): ColumnViewColumnState[] => {
  const currentColIds = colDefs
    .map(getColId)
    .filter((colId): colId is string => Boolean(colId));
  const currentColIdSet = new Set(currentColIds);
  const savedColIdSet = new Set<string>();
  const reconciled = savedState.raw_column_state
    .filter(columnState => currentColIdSet.has(columnState.colId))
    .map(columnState => {
      savedColIdSet.add(columnState.colId);
      return pickColumnViewState(columnState, options);
    });

  currentColIds.forEach(colId => {
    if (!savedColIdSet.has(colId)) {
      reconciled.push({ colId, hide: false });
    }
  });

  return reconciled;
};
