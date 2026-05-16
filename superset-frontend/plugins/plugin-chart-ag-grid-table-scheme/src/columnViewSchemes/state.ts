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
