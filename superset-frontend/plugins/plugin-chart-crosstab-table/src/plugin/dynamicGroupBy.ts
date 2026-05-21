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
  signature: string;
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

function assertNonOverlappingSlots(slots: CrosstabDynamicGroupBySlot[]): void {
  const occupied = new Map<DynamicGroupByPlacement, Set<number>>([
    ['rows', new Set<number>()],
    ['columns', new Set<number>()],
  ]);

  slots.forEach(slot => {
    const { placement, slotIndex, spliceCount } = slot;
    const placementSlots = occupied.get(placement);

    if (!placementSlots || spliceCount === undefined) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
    }

    for (let offset = 0; offset < spliceCount; offset += 1) {
      const dimensionIndex = slotIndex + offset;

      if (placementSlots.has(dimensionIndex)) {
        throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
      }

      placementSlots.add(dimensionIndex);
    }
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
  assertNonOverlappingSlots(slots);

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

function replaceDimension(
  dimensions: QueryFormColumn[],
  slotIndex: number,
  selectedColumn: QueryFormColumn,
): QueryFormColumn[] {
  if (slotIndex >= dimensions.length) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  }

  return [
    ...dimensions.slice(0, slotIndex),
    selectedColumn,
    ...dimensions.slice(slotIndex + 1),
  ];
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
      signature: createGroupBySignature(rowDimensions, columnDimensions),
    };
  }

  const slot = config.slots[0];

  if (!slot?.options.length) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  }

  const selectedOptionId = ownState?.selectedDynamicGroupBy?.[slot.id];
  const selectedColumn = ownState?.selectedDynamicGroupByColumn;
  const selectedOption =
    selectedOptionId !== undefined
      ? slot.options.find(option => option.id === selectedOptionId)
      : selectedColumn !== undefined
        ? slot.options.find(option =>
            option.columns.some(
              column =>
                getColumnLabel(column) === getColumnLabel(selectedColumn),
            ),
          )
        : slot.options.find(option => option.id === slot.defaultOptionId);

  if (!selectedOption) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  }

  const effectiveSelectedColumn = selectedOption.columns[0];

  if (!isValidQueryFormColumn(effectiveSelectedColumn)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  }

  const effectiveRowDimensions =
    slot.placement === 'rows'
      ? replaceDimension(rowDimensions, slot.slotIndex, effectiveSelectedColumn)
      : rowDimensions;
  const effectiveColumnDimensions =
    slot.placement === 'columns'
      ? replaceDimension(
          columnDimensions,
          slot.slotIndex,
          effectiveSelectedColumn,
        )
      : columnDimensions;

  return {
    rowDimensions: effectiveRowDimensions,
    columnDimensions: effectiveColumnDimensions,
    config,
    selectedColumn: effectiveSelectedColumn,
    signature: createGroupBySignature(
      effectiveRowDimensions,
      effectiveColumnDimensions,
    ),
  };
}
