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

function assertColumn(value: unknown): asserts value is QueryFormColumn {
  if (!getColumnLabel(value as QueryFormColumn)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }
}

function validateDynamicGroupByConfig(
  value: unknown,
): CrosstabDynamicGroupByConfig {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const { defaultColumn, enabled, options, placement, slotIndex } = value;

  if (
    typeof enabled !== 'boolean' ||
    !isPlacement(placement) ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    !Array.isArray(options)
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  assertColumn(defaultColumn);

  options.forEach(option => {
    if (!isObject(option) || typeof option.label !== 'string') {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
    }

    assertColumn(option.column);
  });

  return {
    enabled,
    placement,
    slotIndex,
    defaultColumn,
    options,
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
    try {
      return validateDynamicGroupByConfig(JSON.parse(rawConfig));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid crosstab dynamic group by JSON config.');
      }

      throw error;
    }
  }

  return validateDynamicGroupByConfig(rawConfig);
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

  if (!config.options.length) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  }

  const selectedColumn =
    ownState?.selectedDynamicGroupByColumn ?? config.defaultColumn;
  const selectedColumnLabel = getColumnLabel(selectedColumn);

  if (
    !config.options.some(
      option => getColumnLabel(option.column) === selectedColumnLabel,
    )
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  }

  const effectiveRowDimensions =
    config.placement === 'rows'
      ? replaceDimension(rowDimensions, config.slotIndex, selectedColumn)
      : rowDimensions;
  const effectiveColumnDimensions =
    config.placement === 'columns'
      ? replaceDimension(columnDimensions, config.slotIndex, selectedColumn)
      : columnDimensions;

  return {
    rowDimensions: effectiveRowDimensions,
    columnDimensions: effectiveColumnDimensions,
    config,
    selectedColumn,
    signature: createGroupBySignature(
      effectiveRowDimensions,
      effectiveColumnDimensions,
    ),
  };
}
