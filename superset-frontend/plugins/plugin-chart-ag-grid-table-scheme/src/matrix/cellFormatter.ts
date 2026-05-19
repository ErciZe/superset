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
import type { CSSProperties } from 'react';
import type { DataRecordValue } from '@superset-ui/core';
import type {
  AdditionalCellFormatter,
  AdditionalCellFormatterResult,
} from '../../../plugin-chart-ag-grid-table/src/types';
import { getMatrixRawValueField } from './matrixTransform';

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

export const MATRIX_CELL_FORMATTER_CALLBACK_DEFAULT = `/*
 * 示例：看板阈值背景色标记
 *
 * 可用参数：
 * row      当前矩阵行完整数据
 * cell     当前单元格上下文，含 field/value/formattedValue/rawValue
 * value    当前展示值
 * rawValue 当前隐藏原始数值，Total 列也可用
 * column   当前列配置
 * rowIndex 行索引
 * colDef   AG Grid 列定义
 *
 * 回调示例：
 * ({ row, rawValue, value: displayValue }) => {
 *   const metricName = String(
 *     row.metric_name_with_unit ?? row.metric_name ?? "",
 *   )
 *     .replace(/（/g, "(")
 *     .replace(/）/g, ")")
 *     .replace(/\\s+/g, "");
 *   const metricBaseName = metricName.replace(/\\([^)]*\\)$/, "");
 *   const rawInput = rawValue ?? displayValue;
 *   const rawNumber =
 *     typeof rawInput === "number"
 *       ? rawInput
 *       : Number(String(rawInput).replace(/[%，,]/g, ""));
 *   const value =
 *     Math.abs(rawNumber) > 1 ? Math.abs(rawNumber) / 100 : Math.abs(rawNumber);
 *   const redThresholds = {
 *     退款金额占比: 0.08,
 *     FBA发货费占比: 0.3,
 *     总仓储费占比: 0.02,
 *     广告花费占比: 0.23,
 *     采购成本占比: 0.17,
 *   };
 *
 *   if (!Number.isFinite(rawNumber)) {
 *     return undefined;
 *   }
 *
 *   if (
 *     metricBaseName === "广告花费占比" &&
 *     value >= 0 &&
 *     value < 0.18
 *   ) {
 *     return {
 *       style: {
 *         backgroundColor: "#52c41a",
 *         color: "#fff",
 *         fontWeight: "bold",
 *       },
 *       tooltip: "广告花费占比低于 18%",
 *     };
 *   }
 *
 *   if (
 *     Object.prototype.hasOwnProperty.call(redThresholds, metricBaseName) &&
 *     value >= redThresholds[metricBaseName]
 *   ) {
 *     return {
 *       style: {
 *         backgroundColor: "#ff4d4f",
 *         color: "#fff",
 *         fontWeight: "bold",
 *       },
 *       tooltip: metricName + "超过阈值",
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
    return undefined;
  }
  const unsupportedStyleField = Object.keys(
    style as Record<string, unknown>,
  ).find(key => !STYLE_WHITELIST.has(key));
  if (unsupportedStyleField) {
    throw new Error(
      `Matrix cell formatter callback returned unsupported style field "${unsupportedStyleField}".`,
    );
  }
  return Object.fromEntries(
    Object.entries(style as Record<string, unknown>)
      .filter(
        ([_key, value]) =>
          typeof value === 'string' || typeof value === 'number',
      )
      .map(([key, value]) => [key, value]),
  ) as Partial<CSSProperties>;
};

const normalizeFormatterResult = (
  result: unknown,
): AdditionalCellFormatterResult | undefined => {
  if (result === undefined || result === null) {
    return undefined;
  }
  if (['string', 'number', 'boolean'].includes(typeof result)) {
    return { text: result as DataRecordValue };
  }
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Matrix cell formatter callback must return an object.');
  }

  const rawResult = result as Record<string, unknown>;
  const unsupportedResultField = Object.keys(rawResult).find(
    key => !FORMATTER_RESULT_WHITELIST.has(key),
  );
  if (unsupportedResultField) {
    throw new Error(
      `Matrix cell formatter callback returned unsupported result field "${unsupportedResultField}".`,
    );
  }
  return {
    ...('text' in rawResult
      ? { text: rawResult.text as DataRecordValue }
      : undefined),
    ...(typeof rawResult.html === 'string' ? { html: rawResult.html } : {}),
    ...(typeof rawResult.className === 'string'
      ? { className: rawResult.className }
      : {}),
    ...(typeof rawResult.tooltip === 'string'
      ? { tooltip: rawResult.tooltip }
      : {}),
    ...(rawResult.style ? { style: sanitizeStyle(rawResult.style) } : {}),
  };
};

const compileMatrixCellFormatterCallback = (source: string) => {
  if (!/=>|\bfunction\b/.test(source)) {
    throw new Error('Matrix cell formatter callback must be a function.');
  }
  // eslint-disable-next-line no-new-func
  const callback = new Function(`"use strict"; return ${source};`)();
  if (typeof callback !== 'function') {
    throw new Error('Matrix cell formatter callback must be a function.');
  }
  return callback as (context: Record<string, unknown>) => unknown;
};

const createSampleFormatterContext = () => ({
  row: {
    metric_name_with_unit: '退款金额占比（%）',
  },
  cell: {
    field: '__matrix_col__sample',
    value: '-10.12%',
    formattedValue: '-10.12%',
    rawValue: -10.12,
  },
  value: '-10.12%',
  rawValue: -10.12,
  column: {
    key: '__matrix_col__sample',
    label: '示例列',
  },
  rowIndex: 0,
  colDef: {
    field: '__matrix_col__sample',
    headerName: '示例列',
  },
});

export const validateMatrixCellFormatterCallback = (
  expression: string | null | undefined,
) => {
  const source = expression?.trim();
  if (!source || !stripComments(source)) {
    return false;
  }
  const callback = compileMatrixCellFormatterCallback(source);
  normalizeFormatterResult(callback(createSampleFormatterContext()));
  return false;
};

export const validateMatrixCellFormatterExpression =
  validateMatrixCellFormatterCallback;

export const formatMatrixCellFormatterCallback = async (
  expression: string | null | undefined,
): Promise<string> => {
  const source = expression?.trim();
  if (!source || !stripComments(source)) {
    return expression ?? '';
  }
  validateMatrixCellFormatterCallback(source);
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

export const createMatrixCellFormatter = (
  expression: string | null | undefined,
): AdditionalCellFormatter | undefined => {
  const source = expression?.trim();
  if (!source || !stripComments(source)) {
    return undefined;
  }

  const callback = compileMatrixCellFormatterCallback(source);

  return params => {
    const field = String(params.colDef?.field ?? params.col.key);
    const rawValue =
      params.data?.[getMatrixRawValueField(field)] ?? params.value;
    const cell = {
      field,
      value: params.value,
      formattedValue: params.valueFormatted,
      rawValue,
    };

    return normalizeFormatterResult(
      callback({
        row: params.data ?? {},
        cell,
        value: params.value,
        rawValue,
        column: params.col,
        rowIndex: params.rowIndex,
        colDef: params.colDef,
      }),
    );
  };
};
