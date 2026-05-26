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
import { type DataRecordValue } from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';
import type { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import type { CSSProperties } from 'react';

export type CrosstabCellFormatterResult = {
  text?: DataRecordValue;
  html?: string;
  tooltip?: string;
  className?: string;
  style?: Partial<CSSProperties>;
};

type CrosstabCellFormatterColumnInfo = DataColumnMeta & {
  metric?: string;
};

type CrosstabCellFormatterParams = {
  data?: Record<string, DataRecordValue>;
  value?: DataRecordValue;
  valueFormatted?: DataRecordValue;
  rowIndex?: number | null;
  colDef?: Pick<ColDef, 'field' | 'headerName'>;
};

type CrosstabCellFormatterContext = {
  row: Record<string, DataRecordValue>;
  cell: {
    field: string;
    value?: DataRecordValue;
    formattedValue?: DataRecordValue;
    rawValue?: DataRecordValue;
  };
  value?: DataRecordValue;
  rawValue?: DataRecordValue;
  column: CrosstabCellFormatterColumnInfo;
  rowIndex?: number | null;
  colDef?: Pick<ColDef, 'field' | 'headerName'>;
};

export type CrosstabCellFormatter = (
  params: CrosstabCellFormatterParams,
  columnInfo: CrosstabCellFormatterColumnInfo,
) => CrosstabCellFormatterResult | undefined;

const STYLE_WHITELIST = new Set([
  'backgroundColor',
  'color',
  'fontWeight',
  'fontStyle',
  'textAlign',
  'textDecoration',
  'opacity',
]);

const FORMATTER_RESULT_WHITELIST = new Set([
  'style',
  'text',
  'html',
  'tooltip',
  'className',
]);

export const CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT = `/*
 * 回调示例：根据单元格内容定制展示文本、样式和提示。
 *
 * 可用参数：
 * row      当前透视表行完整数据
 * cell     当前单元格上下文，含 field/value/formattedValue/rawValue
 * value    当前展示值，优先使用 formattedValue
 * rawValue 当前原始值
 * column   当前列配置
 * rowIndex 行索引
 * colDef   AG Grid 列定义
 *
 * 回调示例：
 * ({ value, rawValue }) => {
 *   if (typeof rawValue === "number" && rawValue < 0) {
 *     return {
 *       text: value,
 *       style: {
 *         color: "#cf1322",
 *         fontWeight: "bold",
 *       },
 *       tooltip: "负值",
 *     };
 *   }
 *
 *   return undefined;
 * }
 */`;

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .trim();

const sanitizeStyle = (style: unknown): Partial<CSSProperties> | undefined => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) {
    throw new Error('style must be an object');
  }

  const unsupportedStyleField = Object.keys(
    style as Record<string, unknown>,
  ).find(key => !STYLE_WHITELIST.has(key));
  if (unsupportedStyleField) {
    throw new Error(`unsupported style field "${unsupportedStyleField}"`);
  }

  const unsupportedStyleValue = Object.entries(
    style as Record<string, unknown>,
  ).find(([, value]) => typeof value !== 'string' && typeof value !== 'number');
  if (unsupportedStyleValue) {
    throw new Error(
      `unsupported style value for field "${unsupportedStyleValue[0]}"`,
    );
  }

  return style as Partial<CSSProperties>;
};

const isTextValue = (value: unknown): value is DataRecordValue =>
  value === null ||
  value === undefined ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

const requireStringField = (
  rawResult: Record<string, unknown>,
  field: 'html' | 'tooltip' | 'className',
): string | undefined => {
  if (!(field in rawResult)) {
    return undefined;
  }

  const value = rawResult[field];
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }

  return value;
};

const normalizeFormatterResult = (
  result: unknown,
): CrosstabCellFormatterResult | undefined => {
  if (result === undefined || result === null) {
    return undefined;
  }

  if (['string', 'number', 'boolean'].includes(typeof result)) {
    return { text: result as DataRecordValue };
  }

  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Crosstab cell formatter callback must return an object.');
  }

  const rawResult = result as Record<string, unknown>;
  const unsupportedResultField = Object.keys(rawResult).find(
    key => !FORMATTER_RESULT_WHITELIST.has(key),
  );
  if (unsupportedResultField) {
    throw new Error(`unsupported result field "${unsupportedResultField}"`);
  }

  const normalizedResult: CrosstabCellFormatterResult = {};

  if ('text' in rawResult) {
    if (!isTextValue(rawResult.text)) {
      throw new Error('text must be a primitive value');
    }
    normalizedResult.text = rawResult.text;
  }

  const html = requireStringField(rawResult, 'html');
  if (html !== undefined) {
    normalizedResult.html = html;
  }

  const tooltip = requireStringField(rawResult, 'tooltip');
  if (tooltip !== undefined) {
    normalizedResult.tooltip = tooltip;
  }

  const className = requireStringField(rawResult, 'className');
  if (className !== undefined) {
    normalizedResult.className = className;
  }

  if ('style' in rawResult) {
    normalizedResult.style = sanitizeStyle(rawResult.style);
  }

  return normalizedResult;
};

const compileCrosstabCellFormatterCallback = (source: string) => {
  if (!/=>|\bfunction\b/.test(source)) {
    throw new Error('Crosstab cell formatter callback must be a function.');
  }

  // eslint-disable-next-line no-new-func
  const callback = new Function(`"use strict"; return ${source};`)();
  if (typeof callback !== 'function') {
    throw new Error('Crosstab cell formatter callback must be a function.');
  }

  return callback as (context: CrosstabCellFormatterContext) => unknown;
};

const createSampleFormatterContext = (): CrosstabCellFormatterContext => ({
  // Mirrors a minimal Crosstab value row so validation can execute result
  // normalization without requiring real chart data.
  row: {
    contract_type: 'Retail',
    metric_name: 'Sales',
    metric_name_with_unit: 'Sales (USD)',
    amount: 1200,
    sales: 1200,
  },
  cell: {
    field: 'sales',
    value: 1200,
    formattedValue: '1,200',
    rawValue: 1200,
  },
  value: '1,200',
  rawValue: 1200,
  column: {
    key: 'sales',
    label: '销售额',
    metric: 'amount',
    dataType: GenericDataType.Numeric,
  },
  rowIndex: 0,
  colDef: {
    field: 'sales',
    headerName: '销售额',
  },
});

export const validateCrosstabCellFormatterCallback = (
  expression: string | null | undefined,
) => {
  const source = expression?.trim();
  if (!source || !stripComments(source)) {
    return false;
  }

  const callback = compileCrosstabCellFormatterCallback(source);
  normalizeFormatterResult(callback(createSampleFormatterContext()));
  return false;
};

export const validateCrosstabCellFormatterExpression =
  validateCrosstabCellFormatterCallback;

export const formatCrosstabCellFormatterCallback = async (
  expression: string | null | undefined,
): Promise<string> => {
  const source = expression?.trim();
  if (!source || !stripComments(source)) {
    return expression ?? '';
  }

  validateCrosstabCellFormatterCallback(source);
  const [prettier, babelPlugin, estreePlugin] = await Promise.all([
    // eslint-disable-next-line import/no-extraneous-dependencies
    import('prettier/standalone'),
    // eslint-disable-next-line import/no-extraneous-dependencies
    import('prettier/plugins/babel'),
    // eslint-disable-next-line import/no-extraneous-dependencies
    import('prettier/plugins/estree'),
  ]);

  return prettier.format(source, {
    parser: 'babel',
    plugins: [
      babelPlugin.default ?? babelPlugin,
      estreePlugin.default ?? estreePlugin,
    ],
  });
};

export const createCrosstabCellFormatter = (
  expression: string | null | undefined,
): CrosstabCellFormatter | undefined => {
  const source = expression?.trim();
  if (!source || !stripComments(source)) {
    return undefined;
  }

  const callback = compileCrosstabCellFormatterCallback(source);

  return (params, columnInfo) => {
    const field = String(params.colDef?.field ?? columnInfo.key);

    return normalizeFormatterResult(
      callback({
        row: params.data ?? {},
        cell: {
          field,
          value: params.value,
          formattedValue: params.valueFormatted,
          rawValue: params.value,
        },
        value: params.valueFormatted ?? params.value,
        rawValue: params.value,
        column: columnInfo,
        rowIndex: params.rowIndex,
        colDef: params.colDef,
      }),
    );
  };
};
