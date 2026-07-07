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
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION,
  getDynamicGroupByConfig,
  resolveDynamicGroupByDimensionConfigs,
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

const sameLabelAdhocSqlColumn: QueryFormColumn = {
  expressionType: 'SQL',
  label: 'Shared Label',
  sqlExpression: 'SUM(revenue)',
};

const sameLabelDifferentAdhocSqlColumn: QueryFormColumn = {
  expressionType: 'SQL',
  label: 'Shared Label',
  sqlExpression: 'SUM(profit)',
};

const sameExpressionDifferentLabelAdhocSqlColumn: QueryFormColumn = {
  expressionType: 'SQL',
  label: 'Duplicated Revenue',
  sqlExpression: 'SUM(revenue)',
};

const multiSlotConfig: CrosstabFormData['dynamicGroupBy'] = {
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
    {
      id: 'level3',
      label: '三级维度',
      placement: 'columns',
      slotIndex: 2,
      spliceCount: 1,
      defaultOptionId: 'none',
      options: [
        { id: 'none', label: '(无)', columns: [] },
        { id: 'msku', label: 'MSKU', columns: ['msku'] },
        { id: 'parent_asin', label: '父体', columns: ['parent_asin'] },
      ],
    },
  ],
};

const multiColumnOptionConfig: CrosstabFormData['dynamicGroupBy'] = {
  enabled: true,
  slots: [
    {
      id: 'level2_pair',
      label: '二级组合',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 2,
      defaultOptionId: 'shop_country',
      options: [
        {
          id: 'shop_country',
          label: '店铺 + 国家',
          columns: ['shop_name', 'country'],
        },
        {
          id: 'msku_parent',
          label: 'MSKU + 父体',
          columns: ['msku', 'parent_asin'],
        },
      ],
    },
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
  test('returns persisted dimensions and signature when disabled', () => {
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
      selectedDynamicGroupBy: undefined,
      signature: 'rows=metric_name_with_unit|columns=biz_date\u001Fshop_name',
    });
  });

  test('returns persisted dimensions when disabled saved config omits slots', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData({
        enabled: false,
      } as CrosstabFormData['dynamicGroupBy']),
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result).toEqual({
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
      config: undefined,
      selectedColumn: undefined,
      selectedDynamicGroupBy: undefined,
      signature: 'rows=metric_name_with_unit|columns=biz_date\u001Fshop_name',
    });
  });

  test('uses the default column when ownState has no selected column', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(baseConfig),
      ownState: {},
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'category_level1'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'shop_name']);
    expect(result.selectedColumn).toBe('shop_name');
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001Fshop_name',
    );
  });

  test('replaces the configured slot with the runtime selected column', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(baseConfig),
      ownState: { selectedDynamicGroupByColumn: 'country' },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'country']);
    expect(result.selectedColumn).toBe('country');
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001Fcountry',
    );
  });

  test('preserves dimension metadata positionally when resolving config slots', () => {
    const result = resolveDynamicGroupByDimensionConfigs({
      formData: createFormData(baseConfig),
      ownState: { selectedDynamicGroupByColumn: 'country' },
      rowConfigs: [{ field: 'metric_name_with_unit' }],
      columnConfigs: [
        { field: 'biz_date', label: 'Date' },
        {
          field: 'shop_name',
          label: 'Shop',
          sort: { by: 'shop_order', direction: 'desc', type: 'number' },
        },
      ],
    });

    expect(result.columnConfigs).toEqual([
      { field: 'biz_date', label: 'Date' },
      {
        field: 'country',
        label: 'Shop',
        sort: { by: 'shop_order', direction: 'desc', type: 'number' },
      },
    ]);
  });

  test('uses option column configs before positional metadata when resolving config slots', () => {
    const result = resolveDynamicGroupByDimensionConfigs({
      formData: createFormData({
        enabled: true,
        slots: [
          {
            id: 'column_level',
            placement: 'columns',
            slotIndex: 1,
            defaultOptionId: 'shop',
            options: [
              {
                id: 'shop',
                label: '店铺',
                columns: ['shop_name'],
                columnConfigs: [
                  {
                    field: 'shop_name',
                    label: '店铺',
                    sort: {
                      by: 'shop_name',
                      direction: 'asc',
                      type: 'string',
                      nulls: 'last',
                    },
                  },
                ],
              },
              {
                id: 'country',
                label: '国家',
                columns: ['country'],
                columnConfigs: [
                  {
                    field: 'country',
                    label: '国家',
                    sort: {
                      by: 'country',
                      direction: 'asc',
                      type: 'string',
                      nulls: 'last',
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
      ownState: {
        selectedDynamicGroupBy: {
          column_level: 'country',
        },
      },
      rowConfigs: [{ field: 'metric_name_with_unit' }],
      columnConfigs: [
        { field: 'biz_date', label: '日期' },
        {
          field: 'shop_name',
          label: '位置继承',
          sort: { by: 'shop_order', direction: 'desc', type: 'number' },
        },
      ],
    });

    expect(result.columnConfigs).toEqual([
      { field: 'biz_date', label: '日期' },
      {
        field: 'country',
        label: '国家',
        sort: {
          by: 'country',
          direction: 'asc',
          type: 'string',
          nulls: 'last',
        },
      },
    ]);
  });

  test('matches valid object columns and uses their labels in the signature', () => {
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
      'rows=metric_name_with_unit|columns=biz_date\u001FOrder month',
    );
  });

  test('canonicalizes runtime label matches to the whitelisted object column', () => {
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
      'rows=metric_name_with_unit|columns=biz_date\u001FOrder month',
    );
  });

  test('parses JSON string config and rejects invalid JSON', () => {
    expect(
      getDynamicGroupByConfig(createFormData(JSON.stringify(baseConfig))),
    ).toEqual({
      enabled: true,
      slots: [
        {
          id: '__legacy__',
          label: 'Group dimension',
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

  test('treats blank string config as disabled', () => {
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
      selectedDynamicGroupBy: undefined,
      signature: 'rows=metric_name_with_unit|columns=biz_date\u001Fshop_name',
    });
  });

  test('rejects malformed object columns in dynamic group by config', () => {
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

  test('throws when enabled legacy config has empty options', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({ ...baseConfig, options: [] }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  });

  test('throws when selected column is outside the whitelist', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData(baseConfig),
        ownState: { selectedDynamicGroupByColumn: 'category_level1' },
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  });

  test('throws when slot index is outside the target dimensions', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({ ...baseConfig, slotIndex: 2 }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  });

  test('normalizes the legacy single-slot shape to one canonical slot', () => {
    expect(getDynamicGroupByConfig(createFormData(baseConfig))).toEqual({
      enabled: true,
      slots: [
        {
          id: '__legacy__',
          label: 'Group dimension',
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

  test('rejects legacy config when default column is outside options', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData({
          ...baseConfig,
          defaultColumn: 'category_level1',
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  });

  test('accepts the canonical slot-array shape without rewriting stable ids', () => {
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

  test('accepts repeated physical columns across canonical slot options', () => {
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
              defaultOptionId: 'shop_by_level2',
              options: [
                {
                  id: 'shop_by_level2',
                  label: '店铺',
                  columns: ['shop_name'],
                },
              ],
            },
            {
              id: 'level3',
              label: '三级维度',
              placement: 'columns',
              slotIndex: 2,
              spliceCount: 1,
              defaultOptionId: 'shop_by_level3',
              options: [
                {
                  id: 'shop_by_level3',
                  label: '店铺',
                  columns: ['shop_name'],
                },
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
          defaultOptionId: 'shop_by_level2',
          options: [
            {
              id: 'shop_by_level2',
              label: '店铺',
              columns: ['shop_name'],
            },
          ],
        },
        {
          id: 'level3',
          label: '三级维度',
          placement: 'columns',
          slotIndex: 2,
          spliceCount: 1,
          defaultOptionId: 'shop_by_level3',
          options: [
            {
              id: 'shop_by_level3',
              label: '店铺',
              columns: ['shop_name'],
            },
          ],
        },
      ],
    });
  });

  test('rejects duplicate canonical slot ids', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'level',
              placement: 'columns',
              slotIndex: 1,
              defaultOptionId: 'shop',
              options: [{ id: 'shop', label: '店铺', columns: ['shop_name'] }],
            },
            {
              id: 'level',
              placement: 'columns',
              slotIndex: 2,
              defaultOptionId: 'country',
              options: [{ id: 'country', label: '国家', columns: ['country'] }],
            },
          ],
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  });

  test('rejects duplicate option ids within one canonical slot', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'level2',
              placement: 'columns',
              slotIndex: 1,
              defaultOptionId: 'dimension',
              options: [
                {
                  id: 'dimension',
                  label: '店铺',
                  columns: ['shop_name'],
                },
                {
                  id: 'dimension',
                  label: '国家',
                  columns: ['country'],
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  });

  test('rejects enabled canonical config with no slots', () => {
    expect(() =>
      getDynamicGroupByConfig(createFormData({ enabled: true, slots: [] })),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  });

  test('rejects non-array canonical slots even with legacy fields present', () => {
    const invalidCanonicalDynamicGroupBy = {
      enabled: true,
      slots: 'bad',
      placement: 'columns',
      slotIndex: 1,
      defaultColumn: 'shop_name',
      options: [{ label: '店铺', column: 'shop_name' }],
    } as unknown as CrosstabFormData['dynamicGroupBy'];

    expect(() =>
      getDynamicGroupByConfig(createFormData(invalidCanonicalDynamicGroupBy)),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  });

  test('rejects canonical slots with empty options', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'level2',
              placement: 'columns',
              slotIndex: 1,
              defaultOptionId: 'shop',
              options: [],
            },
          ],
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  });

  test('rejects option columns that do not match spliceCount', () => {
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

  test('applies multiple selected slots against original persisted positions', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(multiSlotConfig),
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'country', 'msku']);
    expect(result.selectedDynamicGroupBy).toEqual({
      level2: 'country',
      level3: 'msku',
    });
    expect(result.selectedColumn).toBe('country');
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001Fcountry\u001Fmsku',
    );
  });

  test('clears later selected slots after an empty previous slot', () => {
    const options = [
      { id: 'none', label: '无', columns: [] },
      { id: 'date', label: '日期', columns: ['biz_date'] },
      { id: 'shop', label: '店铺', columns: ['shop_name'] },
      { id: 'country', label: '国家', columns: ['country'] },
      { id: 'msku', label: 'MSKU', columns: ['msku'] },
    ];
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData({
        enabled: true,
        slots: [
          {
            id: 'dimension1',
            placement: 'columns',
            slotIndex: 0,
            spliceCount: 1,
            defaultOptionId: 'date',
            options,
          },
          {
            id: 'dimension2',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop',
            options,
          },
          {
            id: 'dimension3',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'country',
            options,
          },
        ],
      }),
      ownState: {
        selectedDynamicGroupBy: {
          dimension1: 'date',
          dimension2: 'none',
          dimension3: 'msku',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name', 'country'],
    });

    expect(result.columnDimensions).toEqual(['biz_date']);
    expect(result.selectedDynamicGroupBy).toEqual({
      dimension1: 'date',
      dimension2: 'none',
      dimension3: 'none',
    });
  });

  test('treats append-position empty option as no-op', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(multiSlotConfig),
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'shop',
          level3: 'none',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'shop_name']);
    expect(result.selectedDynamicGroupBy).toEqual({
      level2: 'shop',
      level3: 'none',
    });
  });

  test('replaces multiple contiguous dimensions for a multi-column option', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(multiColumnOptionConfig),
      ownState: {
        selectedDynamicGroupBy: {
          level2_pair: 'msku_parent',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name', 'country'],
    });

    expect(result.columnDimensions).toEqual([
      'biz_date',
      'msku',
      'parent_asin',
    ]);
    expect(result.selectedDynamicGroupBy).toEqual({
      level2_pair: 'msku_parent',
    });
  });

  test('applies selected row and column slots across placements', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData({
        enabled: true,
        slots: [
          {
            id: 'row_level',
            label: '行维度',
            placement: 'rows',
            slotIndex: 0,
            spliceCount: 1,
            defaultOptionId: 'metric',
            options: [
              {
                id: 'metric',
                label: '指标',
                columns: ['metric_name_with_unit'],
              },
              {
                id: 'metric_family',
                label: '指标族',
                columns: ['metric_family'],
              },
            ],
          },
          {
            id: 'column_level',
            label: '列维度',
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
      ownState: {
        selectedDynamicGroupBy: {
          row_level: 'metric_family',
          column_level: 'country',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.rowDimensions).toEqual(['metric_family']);
    expect(result.columnDimensions).toEqual(['biz_date', 'country']);
    expect(result.selectedDynamicGroupBy).toEqual({
      row_level: 'metric_family',
      column_level: 'country',
    });
    expect(result.selectedColumn).toBe('metric_family');
  });

  test('maps legacy selectedDynamicGroupByColumn to the legacy slot option', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(baseConfig),
      ownState: { selectedDynamicGroupByColumn: 'country' },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'country']);
    expect(result.selectedDynamicGroupBy).toEqual({ __legacy__: 'country' });
    expect(result.selectedColumn).toBe('country');
  });

  test('throws when selected option id is outside the slot whitelist', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData(multiSlotConfig),
        ownState: {
          selectedDynamicGroupBy: {
            level2: 'bad-option',
          },
        },
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  });

  test('throws when slot ranges overlap within one placement', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({
          enabled: true,
          slots: [
            {
              id: 'first',
              placement: 'columns',
              slotIndex: 1,
              spliceCount: 2,
              defaultOptionId: 'shop_country',
              options: [
                {
                  id: 'shop_country',
                  label: '店铺 + 国家',
                  columns: ['shop_name', 'country'],
                },
              ],
            },
            {
              id: 'second',
              placement: 'columns',
              slotIndex: 2,
              spliceCount: 1,
              defaultOptionId: 'msku',
              options: [{ id: 'msku', label: 'MSKU', columns: ['msku'] }],
            },
          ],
        }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name', 'country'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
  });

  test('throws when the same physical string column is duplicated after resolution', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({
          enabled: true,
          slots: [
            {
              id: 'level3',
              placement: 'columns',
              slotIndex: 2,
              spliceCount: 1,
              defaultOptionId: 'shop',
              options: [{ id: 'shop', label: '店铺', columns: ['shop_name'] }],
            },
          ],
        }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN);
  });

  test('allows same-label adhoc SQL columns with different expressions', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData({
        enabled: true,
        slots: [
          {
            id: 'append_sql',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'profit',
            options: [
              {
                id: 'profit',
                label: 'Profit',
                columns: [sameLabelDifferentAdhocSqlColumn],
              },
            ],
          },
        ],
      }),
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', sameLabelAdhocSqlColumn],
    });

    expect(result.columnDimensions).toEqual([
      'biz_date',
      sameLabelAdhocSqlColumn,
      sameLabelDifferentAdhocSqlColumn,
    ]);
  });

  test('throws when adhoc SQL columns share an expression with different labels', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({
          enabled: true,
          slots: [
            {
              id: 'append_sql',
              placement: 'columns',
              slotIndex: 2,
              spliceCount: 1,
              defaultOptionId: 'duplicated_revenue',
              options: [
                {
                  id: 'duplicated_revenue',
                  label: 'Duplicated revenue',
                  columns: [sameExpressionDifferentLabelAdhocSqlColumn],
                },
              ],
            },
          ],
        }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', sameLabelAdhocSqlColumn],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN);
  });

  test('throws when total effective dimensions exceed MAX_DIMENSIONS', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({
          enabled: true,
          slots: [
            {
              id: 'append',
              placement: 'columns',
              slotIndex: 4,
              spliceCount: 1,
              defaultOptionId: 'extra',
              options: [{ id: 'extra', label: 'Extra', columns: ['extra'] }],
            },
          ],
        }),
        rowDimensions: ['row1', 'row2', 'row3', 'row4'],
        columnDimensions: ['col1', 'col2', 'col3', 'col4'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS);
  });
});
