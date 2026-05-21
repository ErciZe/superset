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

import type { CrosstabCalculatedField } from '../../types';

export const ERR_CROSSTAB_CALC_DIALECT = 'ERR_CROSSTAB_CALC_DIALECT';
export const ERR_CROSSTAB_CALC_FIELD = 'ERR_CROSSTAB_CALC_FIELD';
export const ERR_CROSSTAB_CALC_METRIC = 'ERR_CROSSTAB_CALC_METRIC';

export type CalcSqlDialect = 'doris';

export type EmitCalculatedFieldSqlArgs = {
  dialect: CalcSqlDialect | string;
  metricSql: Record<string, string>;
  parameterValues: Record<string, number>;
};

const unsafeSqlTokenPattern = /(;|--|\/\*|\*\/|'|\{\{|\}\}|\$\{)/;

function assertDialect(
  dialect: CalcSqlDialect | string,
): asserts dialect is 'doris' {
  if (dialect !== 'doris') {
    throw new Error(ERR_CROSSTAB_CALC_DIALECT);
  }
}

function getMetricKey(metric: QueryFormMetric): string {
  const key = getMetricLabel(metric).trim();

  if (key.length === 0) {
    throw new Error(ERR_CROSSTAB_CALC_METRIC);
  }

  return key;
}

function getMetricSql(
  metric: QueryFormMetric,
  metricSql: Record<string, string>,
): string {
  const key = getMetricKey(metric);
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

function safeDiv(
  leftSql: string,
  rightSql: string,
  dialect: CalcSqlDialect | string,
): string {
  assertDialect(dialect);

  return `(CASE WHEN ${rightSql} = 0 THEN NULL ELSE ${leftSql} / ${rightSql} END)`;
}

function getFiniteParameter(
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

export function emitCalculatedFieldSql(
  field: CrosstabCalculatedField,
  args: EmitCalculatedFieldSqlArgs,
): string {
  assertDialect(args.dialect);

  if (field.id.trim().length === 0 || field.label.trim().length === 0) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  const leftSql = getMetricSql(field.inputs.leftMetric, args.metricSql);
  const rightSql = getMetricSql(field.inputs.rightMetric, args.metricSql);

  switch (field.template) {
    case 'ratio':
      return safeDiv(leftSql, rightSql, args.dialect);
    case 'difference':
      return `(${leftSql} - ${rightSql})`;
    case 'parameterized_ratio': {
      const parameterValue = getFiniteParameter(
        field.inputs.parameterName,
        args.parameterValues,
      );

      return `(${safeDiv(leftSql, rightSql, args.dialect)} * ${parameterValue})`;
    }
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}
