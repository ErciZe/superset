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
import {
  CurrencyFormatter,
  DataRecordValue,
  getNumberFormatter,
  isDefined,
  isProbablyHTML,
  sanitizeHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ValueFormatterParams,
  ValueGetterParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { DataColumnMeta, InputColumn } from '../types';
import DateWithFormatter from './DateWithFormatter';

/**
 * Format text for cell value.
 */
function formatValue(
  formatter: DataColumnMeta['formatter'],
  value: DataRecordValue,
  nullValue = 'N/A',
): [boolean, string] {
  // render undefined as empty string
  if (value === undefined) {
    return [false, ''];
  }
  // Render null with the configured per-column placeholder.
  if (
    value === null ||
    // null values in temporal columns are wrapped in a Date object, so make sure we
    // handle them here too
    (value instanceof DateWithFormatter && value.input === null)
  ) {
    return [false, nullValue];
  }
  if (formatter) {
    return [false, formatter(value as number)];
  }
  if (typeof value === 'string') {
    return isProbablyHTML(value) ? [true, sanitizeHtml(value)] : [false, value];
  }
  return [false, value.toString()];
}

export function formatColumnValue(
  column: DataColumnMeta,
  value: DataRecordValue,
) {
  const { dataType, formatter, config = {} } = column;
  const isNumber = dataType === GenericDataType.Numeric;
  const smallNumberFormatter =
    config.d3SmallNumberFormat === undefined
      ? formatter
      : config.currencyFormat
        ? new CurrencyFormatter({
            d3Format: config.d3SmallNumberFormat,
            currency: config.currencyFormat,
          })
        : getNumberFormatter(config.d3SmallNumberFormat);
  return formatValue(
    isNumber && typeof value === 'number' && Math.abs(value) < 1
      ? smallNumberFormatter
      : formatter,
    value,
    config.nullValue,
  );
}

export const valueFormatter = (
  params: ValueFormatterParams,
  col: InputColumn,
): string => {
  const { value, node } = params;
  const isNull =
    value === null ||
    (value instanceof DateWithFormatter && value.input === null);
  if (isNull) {
    if (node?.level === -1) {
      return '';
    }
    return col.config?.nullValue ?? 'N/A';
  }
  if (isDefined(value) && value !== '' && !isNull) {
    return col.formatter?.(value) || value;
  }
  if (node?.level === -1) {
    return '';
  }
  return 'N/A';
};

export const valueGetter = (params: ValueGetterParams, col: InputColumn) => {
  // @ts-ignore
  if (params?.colDef?.isMain) {
    const modifiedColId = `Main ${params.column.getColId()}`;
    return params.data[modifiedColId];
  }
  const columnId = params.column.getColId();
  const value = params.data?.[columnId];
  if (value === null || isDefined(value)) {
    return value;
  }
  if (col.isNumeric) {
    return undefined;
  }
  return '';
};
