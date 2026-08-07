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
import { ValueFormatterParams } from '@superset-ui/core/components/ThemedAgGridReact';
import { DataColumnMeta, InputColumn } from '../../../src/table/types';
import {
  formatColumnValue,
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
  isNumeric: true,
  isMetric: true,
  isPercentMetric: false,
  config: column.config ?? {},
});

const formatterParams = (value: unknown): ValueFormatterParams =>
  ({ value, node: { level: 0 } }) as ValueFormatterParams;

test('uses a configured placeholder for null detail values', () => {
  expect(formatColumnValue(detailColumn, null)[1]).toBe('-');
  expect(
    valueFormatter(formatterParams(null), toInputColumn(detailColumn)),
  ).toBe('-');
});

test('uses the configured placeholder for null temporal wrappers', () => {
  const temporalColumn: DataColumnMeta = {
    ...detailColumn,
    dataType: GenericDataType.Temporal,
  };
  const temporalValue = new DateWithFormatter(null);

  expect(formatColumnValue(temporalColumn, temporalValue)[1]).toBe('-');
  expect(
    valueFormatter(
      formatterParams(temporalValue),
      toInputColumn(temporalColumn),
    ),
  ).toBe('-');
});

test('keeps N/A as the default placeholder', () => {
  expect(formatColumnValue(defaultColumn, null)[1]).toBe('N/A');
  expect(
    valueFormatter(formatterParams(null), toInputColumn(defaultColumn)),
  ).toBe('N/A');
});
