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
import type { QueryFormColumn } from '@superset-ui/core';
import type {
  CrosstabDynamicGroupByInput,
  CrosstabFormData,
} from '../../src/types';
import {
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION,
  getDynamicGroupByConfig,
  resolveDynamicGroupByDimensions,
} from '../../src/plugin/dynamicGroupBy';

const baseConfig: CrosstabDynamicGroupByInput = {
  enabled: true,
  placement: 'columns',
  slotIndex: 1,
  defaultColumn: 'shop_name',
  options: [
    { label: '店铺', column: 'shop_name' },
    { label: '国家', column: 'country' },
  ],
};

const adhocSqlColumn: QueryFormColumn = {
  expressionType: 'SQL',
  label: 'Order month',
  sqlExpression: "DATE_TRUNC('month', order_date)",
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

  it('matches valid object columns and uses their labels in the signature', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData({
        ...baseConfig,
        defaultColumn: adhocSqlColumn,
        options: [{ label: 'Order month', column: adhocSqlColumn }],
      }),
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', adhocSqlColumn]);
    expect(result.selectedColumn).toBe(adhocSqlColumn);
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fOrder month',
    );
  });

  it('canonicalizes runtime label matches to the whitelisted object column', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData({
        ...baseConfig,
        defaultColumn: 'shop_name',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: 'Order month', column: adhocSqlColumn },
        ],
      }),
      ownState: { selectedDynamicGroupByColumn: 'Order month' },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', adhocSqlColumn]);
    expect(result.selectedColumn).toBe(adhocSqlColumn);
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fOrder month',
    );
  });

  it('parses JSON string config and rejects invalid JSON', () => {
    expect(
      getDynamicGroupByConfig(createFormData(JSON.stringify(baseConfig))),
    ).toEqual({
      enabled: true,
      slots: [
        {
          id: '__legacy__',
          label: '分组维度',
          placement: 'columns',
          slotIndex: 1,
          spliceCount: 1,
          defaultOptionId: 'shop_name',
          options: [
            { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
            { id: 'country', label: '国家', columns: ['country'] },
          ],
        },
      ],
    });

    expect(() => getDynamicGroupByConfig(createFormData('{'))).toThrow(
      'Invalid crosstab dynamic group by JSON config.',
    );
  });

  it('treats blank string config as disabled', () => {
    expect(getDynamicGroupByConfig(createFormData(''))).toBeUndefined();
    expect(getDynamicGroupByConfig(createFormData('   '))).toBeUndefined();

    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(''),
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

  it('rejects malformed object columns in dynamic group by config', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData(
          JSON.stringify({
            ...baseConfig,
            defaultColumn: { label: 'Malformed column' },
          }),
        ),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  });

  it('throws when enabled legacy config has empty options', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({ ...baseConfig, options: [] }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
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

  it('normalizes the legacy single-slot shape to one canonical slot', () => {
    expect(getDynamicGroupByConfig(createFormData(baseConfig))).toEqual({
      enabled: true,
      slots: [
        {
          id: '__legacy__',
          label: '分组维度',
          placement: 'columns',
          slotIndex: 1,
          spliceCount: 1,
          defaultOptionId: 'shop_name',
          options: [
            { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
            { id: 'country', label: '国家', columns: ['country'] },
          ],
        },
      ],
    });
  });

  it('rejects legacy config when default column is outside options', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData({
          ...baseConfig,
          defaultColumn: 'category_level1',
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  });

  it('accepts the canonical slot-array shape without rewriting stable ids', () => {
    expect(
      getDynamicGroupByConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'level2',
              label: '二级维度',
              placement: 'columns',
              slotIndex: 1,
              spliceCount: 1,
              defaultOptionId: 'shop',
              options: [
                { id: 'shop', label: '店铺', columns: ['shop_name'] },
                { id: 'country', label: '国家', columns: ['country'] },
              ],
            },
          ],
        }),
      ),
    ).toEqual({
      enabled: true,
      slots: [
        {
          id: 'level2',
          label: '二级维度',
          placement: 'columns',
          slotIndex: 1,
          spliceCount: 1,
          defaultOptionId: 'shop',
          options: [
            { id: 'shop', label: '店铺', columns: ['shop_name'] },
            { id: 'country', label: '国家', columns: ['country'] },
          ],
        },
      ],
    });
  });

  it('rejects enabled canonical config with no slots', () => {
    expect(() =>
      getDynamicGroupByConfig(createFormData({ enabled: true, slots: [] })),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  });

  it('rejects option columns that do not match spliceCount', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'level2_pair',
              placement: 'columns',
              slotIndex: 1,
              spliceCount: 2,
              defaultOptionId: 'bad',
              options: [{ id: 'bad', label: 'Bad', columns: ['shop_name'] }],
            },
          ],
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT);
  });
});
