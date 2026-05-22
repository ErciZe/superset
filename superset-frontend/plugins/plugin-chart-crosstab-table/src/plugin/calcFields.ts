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
  CrosstabExpressionNode,
  CrosstabFormData,
  CrosstabV4CalculatedField,
  MetricFieldConfig,
} from '../types';
import {
  emitCalculatedFieldAstSql,
  type CalcSqlDialect,
  type EmitCalculatedFieldAstSqlArgs,
} from './calc/expr';

export const ERR_CROSSTAB_CALC_FIELD = 'ERR_CROSSTAB_CALC_FIELD';

type ExpandCalculatedFieldMetricConfigsArgs = {
  dialect: CalcSqlDialect;
  formData: CrosstabFormData;
  metricConfigs: MetricFieldConfig[];
  parameterValues: EmitCalculatedFieldAstSqlArgs['parameterValues'];
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

const calculatedFieldResultTypes: ReadonlySet<unknown> = new Set([
  'number',
  'ratio',
  'percent',
  'text',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertCalculatedField(
  value: unknown,
): asserts value is CrosstabV4CalculatedField {
  if (!isObject(value) || !isObject(value.ast)) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  const { ast, description, formatString, id, name, resultType } = value;

  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    !calculatedFieldResultTypes.has(resultType) ||
    (description !== undefined && typeof description !== 'string') ||
    (formatString !== undefined && typeof formatString !== 'string')
  ) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  void ast;
}

function parseCalculatedFields(
  value:
    | CrosstabFormData['crosstabCalculatedFields']
    | CrosstabFormData['calculatedFields'],
): CrosstabV4CalculatedField[] {
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
      const nextMetricSql = { ...metricSql };
      const metricLabel = getMetricLabel(config.metric);

      nextMetricSql[metricLabel] = sqlExpression;

      if (config.label !== undefined && config.label.trim().length > 0) {
        nextMetricSql[config.label] = sqlExpression;
      }

      return nextMetricSql;
    }

    return metricSql;
  }, {});
}

function isCalculatedFieldPlaceholder(
  config: MetricFieldConfig,
  calculatedFieldById: Map<string, CrosstabV4CalculatedField>,
): boolean {
  const field =
    config.calculatedFieldId === undefined
      ? undefined
      : calculatedFieldById.get(config.calculatedFieldId);

  return (
    field !== undefined &&
    typeof config.metric === 'string' &&
    getSqlMetricExpression(config.metric) === undefined &&
    (config.metric === field.name || config.label === field.name)
  );
}

function assertNoDuplicateFields(
  metricConfigs: MetricFieldConfig[],
  calculatedFields: CrosstabV4CalculatedField[],
): void {
  const labels = new Set<string>();
  const ids = new Set<string>();

  metricConfigs.forEach(config => {
    labels.add(getMetricLabel(config.metric));
    if (config.label !== undefined) {
      labels.add(config.label);
    }
  });

  calculatedFields.forEach(field => {
    const id = field.id.trim();
    const name = field.name.trim();

    if (ids.has(id) || labels.has(name)) {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }

    ids.add(id);
    labels.add(name);
  });
}

function stripCalculatedFieldPlaceholders(
  metricConfigs: MetricFieldConfig[],
  calculatedFields: CrosstabV4CalculatedField[],
): MetricFieldConfig[] {
  const calculatedFieldById = new Map(
    calculatedFields.map(field => [field.id, field]),
  );

  return metricConfigs.filter(
    config => !isCalculatedFieldPlaceholder(config, calculatedFieldById),
  );
}

function calculatedMetric(
  field: CrosstabV4CalculatedField,
  sqlExpression: string,
): QueryFormMetric {
  return {
    expressionType: 'SQL',
    label: field.name,
    sqlExpression,
  };
}

function getCalculatedFieldSemantic(
  field: CrosstabV4CalculatedField,
): MetricFieldConfig['semantic'] {
  switch (field.resultType) {
    case 'percent':
    case 'ratio':
      return 'ratio';
    case 'number':
      return 'additive';
    case 'text':
      return 'unknown';
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
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
): CrosstabV4CalculatedField[] {
  try {
    return parseCalculatedFields(
      formData.crosstabCalculatedFields ?? formData.calculatedFields,
    );
  } catch (error) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function collectMetricRefs(
  node: CrosstabExpressionNode,
  metricRefs: Set<string>,
): void {
  switch (node.kind) {
    case 'metric_ref':
      metricRefs.add(node.metricId);
      return;
    case 'binary_op':
      collectMetricRefs(node.left, metricRefs);
      collectMetricRefs(node.right, metricRefs);
      return;
    case 'safe_div':
    case 'pct':
    case 'ratio':
      collectMetricRefs(node.numerator, metricRefs);
      collectMetricRefs(node.denominator, metricRefs);
      return;
    case 'number_param':
    case 'text_param':
    case 'literal_number':
    case 'literal_text':
      return;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function assertNoRecursiveCalculatedFields(
  calculatedFields: CrosstabV4CalculatedField[],
): void {
  const calculatedIds = new Set(calculatedFields.map(field => field.id));
  const refsById = new Map<string, string[]>();

  calculatedFields.forEach(field => {
    const metricRefs = new Set<string>();
    collectMetricRefs(field.ast, metricRefs);
    refsById.set(
      field.id,
      [...metricRefs].filter(metricId => calculatedIds.has(metricId)),
    );
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(fieldId: string): void {
    if (visiting.has(fieldId)) {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }

    if (visited.has(fieldId)) {
      return;
    }

    visiting.add(fieldId);
    refsById.get(fieldId)?.forEach(visit);
    visiting.delete(fieldId);
    visited.add(fieldId);
  }

  calculatedFields.forEach(field => visit(field.id));
}

function getCalculatedMetricSqlMap({
  calculatedFields,
  dialect,
  metricSql,
  parameterValues,
}: {
  calculatedFields: CrosstabV4CalculatedField[];
  dialect: CalcSqlDialect;
  metricSql: Record<string, string>;
  parameterValues: EmitCalculatedFieldAstSqlArgs['parameterValues'];
}): Record<string, string> {
  const fieldById = new Map(calculatedFields.map(field => [field.id, field]));
  const resolvedMetricSql = { ...metricSql };
  const resolving = new Set<string>();

  function resolveFieldSql(field: CrosstabV4CalculatedField): string {
    const existingSql = resolvedMetricSql[field.id];

    if (existingSql !== undefined) {
      return existingSql;
    }

    if (resolving.has(field.id)) {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }

    resolving.add(field.id);

    const metricRefs = new Set<string>();
    collectMetricRefs(field.ast, metricRefs);
    metricRefs.forEach(metricId => {
      const referencedField = fieldById.get(metricId);

      if (referencedField !== undefined) {
        const referencedSql = resolveFieldSql(referencedField);
        resolvedMetricSql[referencedField.id] = referencedSql;
        resolvedMetricSql[referencedField.name] = referencedSql;
      }
    });

    const sqlExpression = emitCalculatedFieldAstSql(field, {
      dialect,
      metricSql: resolvedMetricSql,
      parameterValues,
    });

    resolving.delete(field.id);
    resolvedMetricSql[field.id] = sqlExpression;
    resolvedMetricSql[field.name] = sqlExpression;

    return sqlExpression;
  }

  calculatedFields.forEach(resolveFieldSql);

  return resolvedMetricSql;
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
  assertNoRecursiveCalculatedFields(calculatedFields);

  const calculatedMetricSql = getCalculatedMetricSqlMap({
    calculatedFields,
    dialect,
    metricSql,
    parameterValues,
  });

  return {
    metricConfigs: [
      ...baseMetricConfigs,
      ...calculatedFields.map(field => ({
        metric: calculatedMetric(
          field,
          calculatedMetricSql[field.id] ?? calculatedMetricSql[field.name],
        ),
        label: field.name,
        semantic: getCalculatedFieldSemantic(field),
        ...(field.formatString === undefined
          ? {}
          : { formatString: field.formatString }),
      })),
    ],
  };
}

export function getCalculatedFieldsSignature(
  calculatedFields: CrosstabV4CalculatedField[],
  parameterValues: EmitCalculatedFieldAstSqlArgs['parameterValues'],
): string {
  return [
    stableSerialize(calculatedFields),
    `parameters:${stableSerialize({
      number: parameterValues.number,
      text: parameterValues.text,
    })}`,
  ].join('|');
}
