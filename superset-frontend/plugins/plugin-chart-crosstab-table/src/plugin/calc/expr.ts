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
import { getMetricLabel } from '@superset-ui/core';
import type { QueryFormMetric } from '@superset-ui/core';

import type {
  CrosstabCalculatedField,
  CrosstabExpressionNode,
  CrosstabV4CalculatedField,
} from '../../types';

export const ERR_CROSSTAB_CALC_DIALECT = 'ERR_CROSSTAB_CALC_DIALECT';
export const ERR_CROSSTAB_CALC_FIELD = 'ERR_CROSSTAB_CALC_FIELD';
export const ERR_CROSSTAB_CALC_METRIC = 'ERR_CROSSTAB_CALC_METRIC';

export type CalcSqlDialect = 'doris';

export type EmitCalculatedFieldSqlArgs = {
  dialect: CalcSqlDialect | string;
  metricSql: Record<string, string>;
  parameterValues: Record<string, number>;
};

export type EmitCalculatedFieldAstSqlArgs = {
  dialect: CalcSqlDialect | string;
  metricSql: Record<string, string>;
  parameterValues: {
    number: Record<string, number>;
    text: Record<string, string>;
  };
};

const unsafeSqlTokenPattern = /(;|--|\/\*|\*\/|'|\{\{|\}\}|\$\{)/;
const binaryOperators: ReadonlySet<unknown> = new Set(['+', '-', '*', '/']);

type AstValueType = 'number' | 'text';

function assertDialect(
  dialect: CalcSqlDialect | string,
): asserts dialect is 'doris' {
  if (dialect !== 'doris') {
    throw new Error(ERR_CROSSTAB_CALC_DIALECT);
  }
}

function assertNonEmptyString(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function assertFiniteNumber(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function assertNumericNode(node: CrosstabExpressionNode): void {
  switch (node.kind) {
    case 'metric_ref':
    case 'number_param':
    case 'literal_number':
      return;
    case 'binary_op':
      assertNumericNode(node.left);
      assertNumericNode(node.right);
      return;
    case 'safe_div':
    case 'pct':
    case 'ratio':
      assertNumericNode(node.numerator);
      assertNumericNode(node.denominator);
      return;
    case 'text_param':
    case 'literal_text':
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function assertNonZeroLiteralDenominator(node: CrosstabExpressionNode): void {
  if (node.kind === 'literal_number' && node.value === 0) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function getNumericCompositionType(
  nodes: CrosstabExpressionNode[],
): AstValueType {
  nodes.forEach(node => {
    if (getAstValueType(node) !== 'number') {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }
  });

  return 'number';
}

function getAstValueType(node: CrosstabExpressionNode): AstValueType {
  switch (node.kind) {
    case 'metric_ref':
    case 'number_param':
    case 'literal_number':
      return 'number';
    case 'text_param':
    case 'literal_text':
      return 'text';
    case 'binary_op':
      return getNumericCompositionType([node.left, node.right]);
    case 'safe_div':
    case 'pct':
    case 'ratio':
      return getNumericCompositionType([node.numerator, node.denominator]);
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function assertResultTypeMatchesAst(field: CrosstabV4CalculatedField): void {
  const astValueType = getAstValueType(field.ast);

  switch (field.resultType) {
    case 'number':
    case 'ratio':
    case 'percent':
      if (astValueType !== 'number') {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      return;
    case 'text':
      if (astValueType !== 'text') {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      return;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

export function validateCalculatedFieldAst(node: CrosstabExpressionNode): void {
  switch (node.kind) {
    case 'metric_ref':
      assertNonEmptyString(node.metricId);
      return;
    case 'number_param':
    case 'text_param':
      assertNonEmptyString(node.parameterId);
      return;
    case 'literal_number':
      assertFiniteNumber(node.value);
      return;
    case 'literal_text':
      if (typeof node.value !== 'string') {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      return;
    case 'binary_op':
      if (!binaryOperators.has(node.op)) {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      assertNumericNode(node.left);
      assertNumericNode(node.right);
      validateCalculatedFieldAst(node.left);
      validateCalculatedFieldAst(node.right);
      return;
    case 'safe_div':
    case 'pct':
    case 'ratio':
      assertNumericNode(node.numerator);
      assertNumericNode(node.denominator);
      assertNonZeroLiteralDenominator(node.denominator);
      validateCalculatedFieldAst(node.numerator);
      validateCalculatedFieldAst(node.denominator);
      return;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function getAstMetricSql(
  metricId: string,
  metricSql: Record<string, string>,
): string {
  const sql = metricSql[metricId];

  if (
    typeof sql !== 'string' ||
    sql.trim().length === 0 ||
    unsafeSqlTokenPattern.test(sql)
  ) {
    throw new Error(ERR_CROSSTAB_CALC_METRIC);
  }

  return sql;
}

function getLegacyMetricKey(metric: QueryFormMetric): string {
  const key = getMetricLabel(metric).trim();

  if (key.length === 0) {
    throw new Error(ERR_CROSSTAB_CALC_METRIC);
  }

  return key;
}

function getLegacyMetricSql(
  metric: QueryFormMetric,
  metricSql: Record<string, string>,
): string {
  const key = getLegacyMetricKey(metric);
  const sql = metricSql[key];

  if (
    typeof sql !== 'string' ||
    sql.trim().length === 0 ||
    unsafeSqlTokenPattern.test(sql)
  ) {
    throw new Error(ERR_CROSSTAB_CALC_METRIC);
  }

  return sql;
}

function getLegacyFiniteParameter(
  parameterName: string | undefined,
  parameterValues: Record<string, number>,
): number {
  if (parameterName === undefined || parameterName.trim().length === 0) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  const parameterValue = parameterValues[parameterName];

  if (
    !Object.prototype.hasOwnProperty.call(parameterValues, parameterName) ||
    !Number.isFinite(parameterValue)
  ) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  return parameterValue;
}

function getNumberParameter(
  parameterId: string,
  parameterValues: EmitCalculatedFieldAstSqlArgs['parameterValues'],
): number {
  const value = parameterValues.number[parameterId];

  if (
    !Object.prototype.hasOwnProperty.call(parameterValues.number, parameterId) ||
    !Number.isFinite(value)
  ) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  return value;
}

function getTextParameter(
  parameterId: string,
  parameterValues: EmitCalculatedFieldAstSqlArgs['parameterValues'],
): string {
  const value = parameterValues.text[parameterId];

  if (
    !Object.prototype.hasOwnProperty.call(parameterValues.text, parameterId) ||
    typeof value !== 'string'
  ) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  return value;
}

function safeDivSql(numeratorSql: string, denominatorSql: string): string {
  return `(CASE WHEN ${denominatorSql} = 0 THEN NULL ELSE ${numeratorSql} / ${denominatorSql} END)`;
}

function emitNodeSql(
  node: CrosstabExpressionNode,
  args: EmitCalculatedFieldAstSqlArgs,
): string {
  switch (node.kind) {
    case 'metric_ref':
      return getAstMetricSql(node.metricId, args.metricSql);
    case 'number_param':
      return String(getNumberParameter(node.parameterId, args.parameterValues));
    case 'text_param':
      return JSON.stringify(
        getTextParameter(node.parameterId, args.parameterValues),
      );
    case 'literal_number':
      return String(node.value);
    case 'literal_text':
      return JSON.stringify(node.value);
    case 'binary_op':
      return `(${emitNodeSql(node.left, args)} ${node.op} ${emitNodeSql(
        node.right,
        args,
      )})`;
    case 'safe_div':
    case 'ratio':
      return safeDivSql(
        emitNodeSql(node.numerator, args),
        emitNodeSql(node.denominator, args),
      );
    case 'pct':
      return `(${safeDivSql(
        emitNodeSql(node.numerator, args),
        emitNodeSql(node.denominator, args),
      )} * 100)`;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

export function emitCalculatedFieldSql(
  field: CrosstabCalculatedField,
  args: EmitCalculatedFieldSqlArgs,
): string {
  assertDialect(args.dialect);

  if (field.id.trim().length === 0 || field.label.trim().length === 0) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  const leftSql = getLegacyMetricSql(field.inputs.leftMetric, args.metricSql);
  const rightSql = getLegacyMetricSql(field.inputs.rightMetric, args.metricSql);

  switch (field.template) {
    case 'ratio':
      return safeDivSql(leftSql, rightSql);
    case 'difference':
      return `(${leftSql} - ${rightSql})`;
    case 'parameterized_ratio': {
      const parameterValue = getLegacyFiniteParameter(
        field.inputs.parameterName,
        args.parameterValues,
      );

      return `(${safeDivSql(leftSql, rightSql)} * ${parameterValue})`;
    }
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

export function emitCalculatedFieldAstSql(
  field: CrosstabV4CalculatedField,
  args: EmitCalculatedFieldAstSqlArgs,
): string {
  assertDialect(args.dialect);

  if (field.id.trim().length === 0 || field.name.trim().length === 0) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  validateCalculatedFieldAst(field.ast);
  assertResultTypeMatchesAst(field);

  return emitNodeSql(field.ast, args);
}
