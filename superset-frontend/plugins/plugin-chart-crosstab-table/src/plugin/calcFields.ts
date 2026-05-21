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
import { getMetricLabel, type QueryFormMetric } from '@superset-ui/core';

import type {
  CrosstabCalculatedField,
  CrosstabFormData,
  MetricFieldConfig,
} from '../types';
import { emitCalculatedFieldSql, type CalcSqlDialect } from './calc/expr';

export const ERR_CROSSTAB_CALC_FIELD = 'ERR_CROSSTAB_CALC_FIELD';

type ExpandCalculatedFieldMetricConfigsArgs = {
  dialect: CalcSqlDialect;
  formData: CrosstabFormData;
  metricConfigs: MetricFieldConfig[];
  parameterValues: Record<string, number>;
};

type ExpandCalculatedFieldMetricConfigsResult = {
  metricConfigs: MetricFieldConfig[];
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const metricSemantics: ReadonlySet<unknown> = new Set([
  'unknown',
  'additive',
  'ratio',
  'average',
  'distinct',
]);

const calculatedFieldTemplates: ReadonlySet<unknown> = new Set([
  'ratio',
  'difference',
  'parameterized_ratio',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQueryMetricObject(value: unknown): value is QueryFormMetric {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.expressionType === 'string' ||
    typeof value.label === 'string' ||
    typeof value.sqlExpression === 'string' ||
    typeof value.column === 'object' ||
    typeof value.aggregate === 'string'
  );
}

function isQueryFormMetricValue(value: unknown): value is QueryFormMetric {
  return typeof value === 'string' || isQueryMetricObject(value);
}

function assertCalculatedField(
  value: unknown,
): asserts value is CrosstabCalculatedField {
  if (!isObject(value) || !isObject(value.inputs)) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  const { formatString, id, inputs, label, semantic, template } = value;

  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    !calculatedFieldTemplates.has(template) ||
    !metricSemantics.has(semantic) ||
    !isQueryFormMetricValue(inputs.leftMetric) ||
    !isQueryFormMetricValue(inputs.rightMetric) ||
    (inputs.parameterName !== undefined &&
      typeof inputs.parameterName !== 'string') ||
    (formatString !== undefined && typeof formatString !== 'string')
  ) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function parseCalculatedFields(
  value: CrosstabFormData['calculatedFields'],
): CrosstabCalculatedField[] {
  if (value === undefined || value === '') {
    return [];
  }

  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;

  if (!Array.isArray(parsed)) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  parsed.forEach(assertCalculatedField);

  return parsed;
}

function getSqlMetricExpression(metric: QueryFormMetric): string | undefined {
  if (
    isObject(metric) &&
    metric.expressionType === 'SQL' &&
    typeof metric.sqlExpression === 'string'
  ) {
    return metric.sqlExpression;
  }

  return undefined;
}

function getMetricSqlMap(
  metricConfigs: MetricFieldConfig[],
): Record<string, string> {
  return metricConfigs.reduce<Record<string, string>>((metricSql, config) => {
    const sqlExpression = getSqlMetricExpression(config.metric);

    if (sqlExpression !== undefined) {
      return {
        ...metricSql,
        [getMetricLabel(config.metric)]: sqlExpression,
      };
    }

    return metricSql;
  }, {});
}

function isCalculatedFieldPlaceholder(
  config: MetricFieldConfig,
  calculatedIds: Set<string>,
): boolean {
  const label = config.label ?? getMetricLabel(config.metric);

  return (
    config.calculatedFieldId !== undefined &&
    calculatedIds.has(config.calculatedFieldId) &&
    typeof config.metric === 'string' &&
    config.metric === label &&
    getSqlMetricExpression(config.metric) === undefined
  );
}

function assertNoDuplicateFields(
  metricConfigs: MetricFieldConfig[],
  calculatedFields: CrosstabCalculatedField[],
): void {
  const labels = new Set<string>();
  const ids = new Set<string>();
  const calculatedIds = new Set(calculatedFields.map(field => field.id));

  metricConfigs.forEach(config => {
    if (isCalculatedFieldPlaceholder(config, calculatedIds)) {
      return;
    }

    labels.add(config.label ?? getMetricLabel(config.metric));
  });

  calculatedFields.forEach(field => {
    if (field.id.trim().length === 0 || field.label.trim().length === 0) {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }

    if (ids.has(field.id) || labels.has(field.label)) {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }

    ids.add(field.id);
    labels.add(field.label);
  });
}

function stripCalculatedFieldPlaceholders(
  metricConfigs: MetricFieldConfig[],
  calculatedFields: CrosstabCalculatedField[],
): MetricFieldConfig[] {
  const calculatedIds = new Set(calculatedFields.map(field => field.id));

  return metricConfigs.filter(
    config => !isCalculatedFieldPlaceholder(config, calculatedIds),
  );
}

function calculatedMetric(
  field: CrosstabCalculatedField,
  sqlExpression: string,
): QueryFormMetric {
  return {
    expressionType: 'SQL',
    label: field.label,
    sqlExpression,
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, JsonValue>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) =>
      leftKey === rightKey ? 0 : leftKey > rightKey ? 1 : -1,
    );

  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableSerialize(entryValue)}`,
    )
    .join(',')}}`;
}

export function getCalculatedFields(
  formData: CrosstabFormData,
): CrosstabCalculatedField[] {
  try {
    return parseCalculatedFields(formData.calculatedFields);
  } catch (error) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

export function expandCalculatedFieldMetricConfigs({
  dialect,
  formData,
  metricConfigs,
  parameterValues,
}: ExpandCalculatedFieldMetricConfigsArgs): ExpandCalculatedFieldMetricConfigsResult {
  const calculatedFields = getCalculatedFields(formData);

  if (calculatedFields.length === 0) {
    return { metricConfigs };
  }

  const baseMetricConfigs = stripCalculatedFieldPlaceholders(
    metricConfigs,
    calculatedFields,
  );
  const metricSql = getMetricSqlMap(baseMetricConfigs);

  assertNoDuplicateFields(baseMetricConfigs, calculatedFields);

  return {
    metricConfigs: [
      ...baseMetricConfigs,
      ...calculatedFields.map(field => ({
        metric: calculatedMetric(
          field,
          emitCalculatedFieldSql(field, {
            dialect,
            metricSql,
            parameterValues,
          }),
        ),
        label: field.label,
        semantic: field.semantic,
        ...(field.formatString === undefined
          ? {}
          : { formatString: field.formatString }),
      })),
    ],
  };
}

export function getCalculatedFieldsSignature(
  calculatedFields: CrosstabCalculatedField[],
  parameterValues: Record<string, number>,
): string {
  const sortedParameterValues = Object.fromEntries(
    Object.entries(parameterValues).sort(([leftKey], [rightKey]) =>
      leftKey === rightKey ? 0 : leftKey > rightKey ? 1 : -1,
    ),
  );
  const parameterSignature = Object.entries(sortedParameterValues)
    .map(([name, value]) => `${name}=${value}`)
    .join('|');

  return [
    stableSerialize(calculatedFields),
    `parameters:${parameterSignature}`,
  ].join('|');
}
