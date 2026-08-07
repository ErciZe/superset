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
import { GenericDataType } from '@apache-superset/core/common';
import {
  ValueFormatterParams,
  ValueGetterParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { DataColumnMeta, InputColumn } from '../../../src/table/types';
import {
  formatColumnValue,
  valueGetter,
  valueFormatter,
} from '../../../src/table/utils/formatValue';
import DateWithFormatter from '../../../src/table/utils/DateWithFormatter';

const detailColumn: DataColumnMeta = {
  key: 'hot_product_index',
  label: 'Hot Product Index',
  dataType: GenericDataType.Numeric,
  config: { nullValue: '-' },
};

const defaultColumn: DataColumnMeta = {
  ...detailColumn,
  config: {},
};

const toInputColumn = (column: DataColumnMeta): InputColumn => ({
  key: column.key,
  label: column.label,
  dataType: column.dataType,
  isNumeric: column.dataType === GenericDataType.Numeric,
  isMetric: true,
  isPercentMetric: false,
  config: column.config ?? {},
});

const formatterParams = (value: unknown): ValueFormatterParams =>
  ({ value, node: { level: 0 } }) as ValueFormatterParams;

const getterParams = (
  data: Record<string, unknown>,
  columnId: string,
): ValueGetterParams =>
  ({ data, column: { getColId: () => columnId } }) as ValueGetterParams;

test('uses a configured placeholder for null detail values', () => {
  expect(formatColumnValue(detailColumn, null)[1]).toBe('-');
  const column = toInputColumn(detailColumn);
  const value = valueGetter(
    getterParams({ hot_product_index: null }, detailColumn.key),
    column,
  );

  expect(value).toBeNull();
  expect(valueFormatter(formatterParams(value), column)).toBe('-');
});

test('uses the configured placeholder for null temporal wrappers', () => {
  const temporalColumn: DataColumnMeta = {
    ...detailColumn,
    key: 'month',
    label: 'Month',
    dataType: GenericDataType.Temporal,
  };
  const temporalValue = new DateWithFormatter(null);
  const column = toInputColumn(temporalColumn);
  const rawNull = valueGetter(getterParams({ month: null }, 'month'), column);

  expect(formatColumnValue(temporalColumn, temporalValue)[1]).toBe('-');
  expect(valueFormatter(formatterParams(temporalValue), column)).toBe('-');
  expect(rawNull).toBeNull();
  expect(valueFormatter(formatterParams(rawNull), column)).toBe('-');
});

test('keeps N/A as the default placeholder', () => {
  expect(formatColumnValue(defaultColumn, null)[1]).toBe('N/A');
  const column = toInputColumn(defaultColumn);
  const missingValue = valueGetter(getterParams({}, defaultColumn.key), column);

  expect(valueFormatter(formatterParams(null), column)).toBe('N/A');
  expect(missingValue).toBeUndefined();
  expect(valueFormatter(formatterParams(missingValue), column)).toBe('N/A');
});
