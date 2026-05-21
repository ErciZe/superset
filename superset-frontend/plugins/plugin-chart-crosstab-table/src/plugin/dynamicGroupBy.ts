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

function validateOption(
  value: unknown,
  spliceCount: number,
): CrosstabDynamicGroupByOption {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const { columns, id, label } = value;

  if (!isNonEmptyString(id) || typeof label !== 'string') {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  assertColumnArray(columns);

  if (columns.length > 0 && columns.length !== spliceCount) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT);
  }

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

  const normalizedOptions = options.map(option =>
    validateOption(option, spliceCount),
  );

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

function assertUniqueSlotIds(slots: CrosstabDynamicGroupBySlot[]): void {
  const seenSlotIds = new Set<string>();

  slots.forEach(slot => {
    if (seenSlotIds.has(slot.id)) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
    }

    seenSlotIds.add(slot.id);
  });
}

export function normalizeDynamicGroupByConfig(
  value: unknown,
): CrosstabDynamicGroupByConfig {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (!('slots' in value)) {
    return normalizeLegacyConfig(value);
  }

  if (typeof value.enabled !== 'boolean' || !Array.isArray(value.slots)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (value.enabled && value.slots.length === 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const slots = value.slots.map(validateSlot);

  assertUniqueSlotIds(slots);

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

function getSlotSpliceCount(slot: CrosstabDynamicGroupBySlot): number {
  return slot.spliceCount ?? 1;
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

function validateSlotRanges(
  slots: CrosstabDynamicGroupBySlot[],
  dimensions: QueryFormColumn[],
): void {
  const occupied = new Set<number>();

  slots.forEach(slot => {
    const { slotIndex } = slot;
    const spliceCount = getSlotSpliceCount(slot);

    if (
      (slot.id === LEGACY_SLOT_ID && slotIndex >= dimensions.length) ||
      slotIndex > dimensions.length ||
      (slotIndex < dimensions.length &&
        slotIndex + spliceCount > dimensions.length)
    ) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
    }

    for (let offset = 0; offset < spliceCount; offset += 1) {
      const dimensionIndex = slotIndex + offset;

      if (occupied.has(dimensionIndex)) {
        throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
      }

      occupied.add(dimensionIndex);
    }
  });
}

function assertNoDuplicateColumns(dimensions: QueryFormColumn[]): void {
  const seenColumns = new Set<string>();

  dimensions.forEach(dimension => {
    const columnLabel = getColumnLabel(dimension);

    if (seenColumns.has(columnLabel)) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN);
    }

    seenColumns.add(columnLabel);
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
  ownState: CrosstabOwnState | undefined,
): ApplySlotsToDimensionsResult {
  validateSlotRanges(slots, dimensions);

  const selectedDynamicGroupBy: Record<string, string> = {};
  const effectiveDimensions = [...dimensions];
  const descendingSlots = [...slots].sort(
    (leftSlot, rightSlot) => rightSlot.slotIndex - leftSlot.slotIndex,
  );

  descendingSlots.forEach(slot => {
    const selectedOptionId = resolveSelectedOptionId(slot, ownState);
    const selectedOption = slot.options.find(
      option => option.id === selectedOptionId,
    );

    if (!selectedOption) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
    }

    selectedDynamicGroupBy[slot.id] = selectedOption.id;
    effectiveDimensions.splice(
      slot.slotIndex,
      slot.slotIndex === dimensions.length ? 0 : getSlotSpliceCount(slot),
      ...selectedOption.columns,
    );
  });

  return {
    dimensions: effectiveDimensions,
    selectedDynamicGroupBy,
  };
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
  const rowResult = applySlotsToDimensions(
    getDimensionsForPlacement('rows', rowDimensions, columnDimensions),
    rowSlots,
    ownState,
  );
  const columnResult = applySlotsToDimensions(
    getDimensionsForPlacement('columns', rowDimensions, columnDimensions),
    columnSlots,
    ownState,
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
