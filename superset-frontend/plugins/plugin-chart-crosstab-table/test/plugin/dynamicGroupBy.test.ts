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
  CrosstabDynamicGroupByConfig,
  CrosstabFormData,
} from '../../src/types';
import {
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT,
  getDynamicGroupByConfig,
  resolveDynamicGroupByDimensions,
} from '../../src/plugin/dynamicGroupBy';

const baseConfig: CrosstabDynamicGroupByConfig = {
  enabled: true,
  placement: 'columns',
  slotIndex: 1,
  defaultColumn: 'shop_name',
  options: [
    { label: '店铺', column: 'shop_name' },
    { label: '国家', column: 'country' },
  ],
};

function createFormData(
  dynamicGroupBy?: CrosstabFormData['dynamicGroupBy'],
): CrosstabFormData {
  return {
    datasource: '1__table',
    viz_type: 'crosstab_table',
    dynamicGroupBy,
  };
}

describe('crosstab dynamic group by resolver', () => {
  it('returns persisted dimensions and signature when disabled', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData({ ...baseConfig, enabled: false }),
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result).toEqual({
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
      config: undefined,
      selectedColumn: undefined,
      signature: 'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
    });
  });

  it('uses the default column when ownState has no selected column', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(baseConfig),
      ownState: {},
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'category_level1'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'shop_name']);
    expect(result.selectedColumn).toBe('shop_name');
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
    );
  });

  it('replaces the configured slot with the runtime selected column', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(baseConfig),
      ownState: { selectedDynamicGroupByColumn: 'country' },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'country']);
    expect(result.selectedColumn).toBe('country');
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
    );
  });

  it('parses JSON string config and rejects invalid JSON', () => {
    expect(
      getDynamicGroupByConfig(createFormData(JSON.stringify(baseConfig))),
    ).toEqual(baseConfig);

    expect(() => getDynamicGroupByConfig(createFormData('{'))).toThrow(
      'Invalid crosstab dynamic group by JSON config.',
    );
  });

  it('throws when enabled config has empty options', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({ ...baseConfig, options: [] }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  });

  it('throws when selected column is outside the whitelist', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData(baseConfig),
        ownState: { selectedDynamicGroupByColumn: 'category_level1' },
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  });

  it('throws when slot index is outside the target dimensions', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({ ...baseConfig, slotIndex: 2 }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  });
});
