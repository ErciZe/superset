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
import { getColumnLabel, type QueryFormColumn } from '@superset-ui/core';
import type {
  CrosstabDynamicGroupByConfig,
  CrosstabDynamicGroupByInput,
  CrosstabDynamicGroupByOption,
  CrosstabDynamicGroupBySlot,
  CrosstabFormData,
  CrosstabOwnState,
  DynamicGroupByPlacement,
} from '../types';
import {
  applyDynamicSlotSplices,
  ERR_DYNAMIC_SLOT_DUPLICATE_OPTION,
  ERR_DYNAMIC_SLOT_DUPLICATE_SLOT,
  ERR_DYNAMIC_SLOT_INVALID_OPTION,
  ERR_DYNAMIC_SLOT_OVERLAP,
  ERR_DYNAMIC_SLOT_SPLICE_COUNT,
  getDynamicSlotSpliceCount,
  resolveDynamicSlotOptions,
  validateDynamicSlots,
  type DynamicSlot,
  type SelectedDynamicSlotOption,
} from './dynamicSlots';

export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS';

const LEGACY_SLOT_ID = '__legacy__';
const LEGACY_SLOT_LABEL = '分组维度';
const MAX_DIMENSIONS = 8;

type ResolveDynamicGroupByDimensionsArgs = {
  formData: CrosstabFormData;
  ownState?: CrosstabOwnState;
  rowDimensions: QueryFormColumn[];
  columnDimensions: QueryFormColumn[];
};

type ResolveDynamicGroupByDimensionsResult = {
  rowDimensions: QueryFormColumn[];
  columnDimensions: QueryFormColumn[];
  config?: CrosstabDynamicGroupByConfig;
  selectedColumn?: QueryFormColumn;
  selectedDynamicGroupBy?: Record<string, string>;
  signature: string;
};

type ApplySlotsToDimensionsResult = {
  dimensions: QueryFormColumn[];
  selectedDynamicGroupBy: Record<string, string>;
};

type DynamicGroupBySlotPayload = readonly QueryFormColumn[];

type DynamicGroupByDynamicSlot = DynamicSlot<DynamicGroupBySlotPayload> &
  Pick<CrosstabDynamicGroupBySlot, 'placement'>;

type SelectedDynamicGroupBySlotOption = SelectedDynamicSlotOption<
  DynamicGroupBySlotPayload,
  DynamicGroupByDynamicSlot
>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlacement(value: unknown): value is DynamicGroupByPlacement {
  return value === 'rows' || value === 'columns';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidAdhocSqlColumn(value: unknown): value is QueryFormColumn {
  return (
    isObject(value) &&
    value.expressionType === 'SQL' &&
    isNonEmptyString(value.sqlExpression) &&
    (value.label === undefined || typeof value.label === 'string')
  );
}

function isValidQueryFormColumn(value: unknown): value is QueryFormColumn {
  return isNonEmptyString(value) || isValidAdhocSqlColumn(value);
}

function assertColumn(value: unknown): asserts value is QueryFormColumn {
  if (!isValidQueryFormColumn(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }
}

function assertSlotId(value: unknown): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  }
}

function assertColumnArray(value: unknown): asserts value is QueryFormColumn[] {
  if (!Array.isArray(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  value.forEach(assertColumn);
}

function parseSlotIndex(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (value >= MAX_DIMENSIONS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS);
  }

  return value;
}

function parseSpliceCount(value: unknown): number {
  if (value === undefined) {
    return 1;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT);
  }

  if (value > MAX_DIMENSIONS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS);
  }

  return value;
}

function normalizeLegacyConfig(
  value: Record<string, unknown>,
): CrosstabDynamicGroupByConfig {
  const { defaultColumn, enabled, options, placement, slotIndex } = value;
  const parsedSlotIndex = parseSlotIndex(slotIndex);

  if (
    typeof enabled !== 'boolean' ||
    !isPlacement(placement) ||
    !Array.isArray(options)
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  assertColumn(defaultColumn);

  if (options.length === 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  }

  const normalizedOptions = options.map(option => {
    if (!isObject(option) || typeof option.label !== 'string') {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
    }

    assertColumn(option.column);

    return {
      id: getColumnLabel(option.column),
      label: option.label,
      columns: [option.column],
    };
  });
  const defaultOptionId = getColumnLabel(defaultColumn);

  if (!normalizedOptions.some(option => option.id === defaultOptionId)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  }

  return {
    enabled,
    slots: [
      {
        id: LEGACY_SLOT_ID,
        label: LEGACY_SLOT_LABEL,
        placement,
        slotIndex: parsedSlotIndex,
        spliceCount: 1,
        defaultOptionId,
        options: normalizedOptions,
      },
    ],
  };
}

function validateOption(value: unknown): CrosstabDynamicGroupByOption {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const { columns, id, label } = value;

  if (!isNonEmptyString(id) || typeof label !== 'string') {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  assertColumnArray(columns);

  return { id, label, columns };
}

function validateSlot(value: unknown): CrosstabDynamicGroupBySlot {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const { defaultOptionId, id, label, options, placement, slotIndex } = value;
  const spliceCount = parseSpliceCount(value.spliceCount);
  const parsedSlotIndex = parseSlotIndex(slotIndex);

  assertSlotId(id);

  if (
    !isPlacement(placement) ||
    (label !== undefined && typeof label !== 'string') ||
    !isNonEmptyString(defaultOptionId) ||
    !Array.isArray(options)
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (options.length === 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  }

  if (parsedSlotIndex + spliceCount > MAX_DIMENSIONS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS);
  }

  const normalizedOptions = options.map(validateOption);

  if (!normalizedOptions.some(option => option.id === defaultOptionId)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  }

  return {
    id,
    ...(label === undefined ? {} : { label }),
    placement,
    slotIndex: parsedSlotIndex,
    spliceCount,
    defaultOptionId,
    options: normalizedOptions,
  };
}

function getDynamicGroupBySlotError(error: Error): Error {
  switch (error.message) {
    case ERR_DYNAMIC_SLOT_DUPLICATE_OPTION:
      return new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
    case ERR_DYNAMIC_SLOT_DUPLICATE_SLOT:
      return new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
    case ERR_DYNAMIC_SLOT_INVALID_OPTION:
      return new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
    case ERR_DYNAMIC_SLOT_OVERLAP:
      return new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
    case ERR_DYNAMIC_SLOT_SPLICE_COUNT:
      return new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT);
    default:
      return error;
  }
}

function getDynamicGroupByDynamicSlot(
  slot: CrosstabDynamicGroupBySlot,
): DynamicGroupByDynamicSlot {
  return {
    id: slot.id,
    placement: slot.placement,
    slotIndex: slot.slotIndex,
    spliceCount: slot.spliceCount,
    defaultOptionId: slot.defaultOptionId,
    options: slot.options.map(option => ({
      id: option.id,
      payload: option.columns,
    })),
  };
}

function validateDynamicGroupBySlots(
  slots: CrosstabDynamicGroupBySlot[],
): void {
  try {
    validateDynamicSlots(slots.map(getDynamicGroupByDynamicSlot), {
      allowEmptyPayload: true,
      getPlacement: slot => slot.placement,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw getDynamicGroupBySlotError(error);
    }

    throw error;
  }
}

export function normalizeDynamicGroupByConfig(
  value: unknown,
): CrosstabDynamicGroupByConfig {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (!('slots' in value)) {
    if (value.enabled === false) {
      return {
        enabled: false,
        slots: [],
      };
    }

    return normalizeLegacyConfig(value);
  }

  if (typeof value.enabled !== 'boolean' || !Array.isArray(value.slots)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (value.enabled && value.slots.length === 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const slots = value.slots.map(validateSlot);

  validateDynamicGroupBySlots(slots);

  return {
    enabled: value.enabled,
    slots,
  };
}

export function getDynamicGroupByConfig(
  formData: CrosstabFormData,
): CrosstabDynamicGroupByConfig | undefined {
  const rawConfig = formData.dynamicGroupBy;

  if (rawConfig === undefined) {
    return undefined;
  }

  if (typeof rawConfig === 'string') {
    if (rawConfig.trim().length === 0) {
      return undefined;
    }

    try {
      return normalizeDynamicGroupByConfig(JSON.parse(rawConfig));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid crosstab dynamic group by JSON config.');
      }

      throw error;
    }
  }

  return normalizeDynamicGroupByConfig(
    rawConfig satisfies CrosstabDynamicGroupByInput,
  );
}

function createGroupBySignature(
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
): string {
  const rowKeys = rowDimensions.map(getColumnLabel);
  const columnKeys = columnDimensions.map(getColumnLabel);

  return `rows=${rowKeys.join('\u001f')}|columns=${columnKeys.join('\u001f')}`;
}

function getDimensionsForPlacement(
  placement: DynamicGroupByPlacement,
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
): QueryFormColumn[] {
  return placement === 'rows' ? rowDimensions : columnDimensions;
}

function resolveLegacySelectedOptionId(
  slot: CrosstabDynamicGroupBySlot,
  selectedColumn: QueryFormColumn,
): string {
  const selectedOption = slot.options.find(
    option =>
      option.columns.length === 1 &&
      getColumnLabel(option.columns[0]) === getColumnLabel(selectedColumn),
  );

  if (!selectedOption) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  }

  return selectedOption.id;
}

function resolveSelectedOptionId(
  slot: CrosstabDynamicGroupBySlot,
  ownState: CrosstabOwnState | undefined,
): string {
  const selectedOptionId = ownState?.selectedDynamicGroupBy?.[slot.id];

  if (selectedOptionId !== undefined) {
    return selectedOptionId;
  }

  if (
    slot.id === LEGACY_SLOT_ID &&
    ownState?.selectedDynamicGroupByColumn !== undefined
  ) {
    return resolveLegacySelectedOptionId(
      slot,
      ownState.selectedDynamicGroupByColumn,
    );
  }

  return slot.defaultOptionId;
}

function validateSlotBounds(
  slots: CrosstabDynamicGroupBySlot[],
  dimensions: QueryFormColumn[],
): void {
  slots.forEach(slot => {
    const { slotIndex } = slot;
    const spliceCount = getDynamicSlotSpliceCount(slot);

    if (
      (slot.id === LEGACY_SLOT_ID && slotIndex >= dimensions.length) ||
      slotIndex > dimensions.length ||
      (slotIndex < dimensions.length &&
        slotIndex + spliceCount > dimensions.length)
    ) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
    }
  });
}

function getColumnIdentity(dimension: QueryFormColumn): string {
  if (isNonEmptyString(dimension)) {
    return `column:${dimension}`;
  }

  if (isValidAdhocSqlColumn(dimension)) {
    return `sql:${dimension.sqlExpression}`;
  }

  throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
}

function assertNoDuplicateColumns(dimensions: QueryFormColumn[]): void {
  const seenColumns = new Set<string>();

  dimensions.forEach(dimension => {
    const columnIdentity = getColumnIdentity(dimension);

    if (seenColumns.has(columnIdentity)) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN);
    }

    seenColumns.add(columnIdentity);
  });
}

function assertMaxDimensions(
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
): void {
  if (rowDimensions.length + columnDimensions.length > MAX_DIMENSIONS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS);
  }
}

function applySlotsToDimensions(
  dimensions: QueryFormColumn[],
  slots: CrosstabDynamicGroupBySlot[],
  selectedOptions: SelectedDynamicGroupBySlotOption[],
): ApplySlotsToDimensionsResult {
  validateSlotBounds(slots, dimensions);

  const selectedDynamicGroupBy: Record<string, string> = {};

  selectedOptions.forEach(({ option, slot }) => {
    selectedDynamicGroupBy[slot.id] = option.id;
  });

  return {
    dimensions: applyDynamicSlotSplices(dimensions, selectedOptions),
    selectedDynamicGroupBy,
  };
}

function resolveSelectedDynamicGroupByOptions(
  slots: CrosstabDynamicGroupBySlot[],
  ownState: CrosstabOwnState | undefined,
): SelectedDynamicGroupBySlotOption[] {
  const selectedOptionIdsBySlot = slots.reduce<Record<string, string>>(
    (selectedOptionIds, slot) => ({
      ...selectedOptionIds,
      [slot.id]: resolveSelectedOptionId(slot, ownState),
    }),
    {},
  );

  try {
    return resolveDynamicSlotOptions(
      slots.map(getDynamicGroupByDynamicSlot),
      selectedOptionIdsBySlot,
    );
  } catch (error) {
    if (error instanceof Error) {
      throw getDynamicGroupBySlotError(error);
    }

    throw error;
  }
}

function getSelectedColumn(
  slots: CrosstabDynamicGroupBySlot[],
  selectedDynamicGroupBy: Record<string, string>,
): QueryFormColumn | undefined {
  const legacySlot = slots.find(slot => slot.id === LEGACY_SLOT_ID);
  const prioritizedSlots = legacySlot ? [legacySlot] : slots;

  for (const slot of prioritizedSlots) {
    const selectedOptionId = selectedDynamicGroupBy[slot.id];
    const selectedOption = slot.options.find(
      option => option.id === selectedOptionId,
    );
    const selectedColumn = selectedOption?.columns[0];

    if (selectedColumn !== undefined) {
      return selectedColumn;
    }
  }

  return undefined;
}

export function resolveDynamicGroupByDimensions({
  formData,
  ownState,
  rowDimensions,
  columnDimensions,
}: ResolveDynamicGroupByDimensionsArgs): ResolveDynamicGroupByDimensionsResult {
  const config = getDynamicGroupByConfig(formData);

  if (!config?.enabled) {
    return {
      rowDimensions,
      columnDimensions,
      config: undefined,
      selectedColumn: undefined,
      selectedDynamicGroupBy: undefined,
      signature: createGroupBySignature(rowDimensions, columnDimensions),
    };
  }

  const rowSlots = config.slots.filter(slot => slot.placement === 'rows');
  const columnSlots = config.slots.filter(slot => slot.placement === 'columns');
  const selectedOptions = resolveSelectedDynamicGroupByOptions(
    config.slots,
    ownState,
  );
  const selectedRowOptions = selectedOptions.filter(
    ({ slot }) => slot.placement === 'rows',
  );
  const selectedColumnOptions = selectedOptions.filter(
    ({ slot }) => slot.placement === 'columns',
  );
  const rowResult = applySlotsToDimensions(
    getDimensionsForPlacement('rows', rowDimensions, columnDimensions),
    rowSlots,
    selectedRowOptions,
  );
  const columnResult = applySlotsToDimensions(
    getDimensionsForPlacement('columns', rowDimensions, columnDimensions),
    columnSlots,
    selectedColumnOptions,
  );
  const selectedDynamicGroupBy = {
    ...rowResult.selectedDynamicGroupBy,
    ...columnResult.selectedDynamicGroupBy,
  };
  const effectiveRowDimensions = rowResult.dimensions;
  const effectiveColumnDimensions = columnResult.dimensions;

  assertNoDuplicateColumns([
    ...effectiveRowDimensions,
    ...effectiveColumnDimensions,
  ]);
  assertMaxDimensions(effectiveRowDimensions, effectiveColumnDimensions);

  return {
    rowDimensions: effectiveRowDimensions,
    columnDimensions: effectiveColumnDimensions,
    config,
    selectedColumn: getSelectedColumn(config.slots, selectedDynamicGroupBy),
    selectedDynamicGroupBy,
    signature: createGroupBySignature(
      effectiveRowDimensions,
      effectiveColumnDimensions,
    ),
  };
}
