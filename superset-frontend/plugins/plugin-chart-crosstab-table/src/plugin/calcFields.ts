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
  CrosstabExpressionNode,
  CrosstabFormData,
  MetricFieldConfig,
} from '../types';
import {
  ERR_CROSSTAB_CALC_METRIC,
  emitCalculatedFieldAstSql,
  type CalcSqlDialect,
  validateCalculatedFieldAst,
} from './calc/expr';
import { getCrosstabParameters } from './parameters';
import { assertNoLegacyV4Inputs } from './v4Contract';

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

type SavedMetricRecord = Record<string, unknown>;

const calculatedFieldResultTypes: ReadonlySet<unknown> = new Set([
  'number',
  'ratio',
  'percent',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertCalculatedField(
  value: unknown,
): asserts value is CrosstabCalculatedField {
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

  validateCalculatedFieldAst(ast as CrosstabExpressionNode);
}

function parseCalculatedFields(
  value: CrosstabFormData['crosstabCalculatedFields'],
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

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getSavedMetricName(metric: SavedMetricRecord): string | undefined {
  return (
    nonEmptyString(metric.metric_name) ??
    nonEmptyString(metric.label) ??
    nonEmptyString(metric.verbose_name)
  );
}

function getSavedMetricNames(metric: SavedMetricRecord): string[] {
  return [
    nonEmptyString(metric.metric_name),
    nonEmptyString(metric.label),
    nonEmptyString(metric.verbose_name),
  ].filter((name): name is string => name !== undefined);
}

function getSavedMetricExpression(
  metric: SavedMetricRecord,
): string | undefined {
  return (
    nonEmptyString(metric.expression) ??
    nonEmptyString(metric.sqlExpression) ??
    nonEmptyString(metric.sql_expression) ??
    (isObject(metric.metric)
      ? getSqlMetricExpression(metric.metric as unknown as QueryFormMetric)
      : undefined)
  );
}

function getDatasourceSavedMetrics(
  formData: CrosstabFormData,
): SavedMetricRecord[] {
  const { datasource, datasourceMetrics, savedMetrics } =
    formData as unknown as {
      datasource?: unknown;
      datasourceMetrics?: unknown;
      savedMetrics?: unknown;
    };

  return [
    ...(isObject(datasource) && Array.isArray(datasource.metrics)
      ? datasource.metrics.filter(isObject)
      : []),
    ...(Array.isArray(datasourceMetrics)
      ? datasourceMetrics.filter(isObject)
      : []),
    ...(Array.isArray(savedMetrics) ? savedMetrics.filter(isObject) : []),
  ];
}

function getDatasourceMetricLookup(
  formData: CrosstabFormData,
): Map<string, SavedMetricRecord> {
  return new Map(
    getDatasourceSavedMetrics(formData).flatMap(metric => {
      const metricNames = getSavedMetricNames(metric);

      return metricNames.map(metricName => [metricName, metric]);
    }),
  );
}

function addMetricSql(
  metricSql: Record<string, string>,
  key: string | undefined,
  sqlExpression: string,
): Record<string, string> {
  if (key !== undefined && key.trim().length > 0) {
    return {
      ...metricSql,
      [key]: sqlExpression,
    };
  }

  return metricSql;
}

function addDatasourceMetricSql(
  metricSql: Record<string, string>,
  key: string,
  sqlExpression: string,
  referencedMetricIds: Set<string>,
  explicitMetricKeys: Set<string>,
): Record<string, string> {
  const existingSqlExpression = metricSql[key];

  if (
    existingSqlExpression !== undefined &&
    existingSqlExpression !== sqlExpression
  ) {
    if (explicitMetricKeys.has(key)) {
      return metricSql;
    }

    if (!referencedMetricIds.has(key)) {
      return metricSql;
    }

    throw new Error(ERR_CROSSTAB_CALC_METRIC);
  }

  return {
    ...metricSql,
    [key]: sqlExpression,
  };
}

function addMetricConfigSql(
  metricSql: Record<string, string>,
  config: MetricFieldConfig,
  datasourceMetricLookup: Map<string, SavedMetricRecord>,
): Record<string, string> {
  const metricRecord = isObject(config.metric)
    ? (config.metric as SavedMetricRecord)
    : undefined;
  const metricName =
    typeof config.metric === 'string'
      ? config.metric
      : metricRecord === undefined
        ? undefined
        : getSavedMetricName(metricRecord);
  const datasourceMetric =
    metricName === undefined
      ? undefined
      : datasourceMetricLookup.get(metricName);
  const sqlExpression =
    getSqlMetricExpression(config.metric) ??
    (metricRecord === undefined
      ? undefined
      : getSavedMetricExpression(metricRecord)) ??
    (datasourceMetric === undefined
      ? undefined
      : getSavedMetricExpression(datasourceMetric));

  if (sqlExpression === undefined) {
    return metricSql;
  }

  const metricLabel = getMetricLabel(config.metric);
  const nextMetricSql = addMetricSql(metricSql, metricLabel, sqlExpression);
  const withConfigLabel = addMetricSql(
    nextMetricSql,
    config.label,
    sqlExpression,
  );
  const withMetricName = addMetricSql(
    withConfigLabel,
    metricName,
    sqlExpression,
  );

  return addMetricSql(
    withMetricName,
    datasourceMetric === undefined
      ? undefined
      : getSavedMetricName(datasourceMetric),
    sqlExpression,
  );
}

function addExplicitMetricConfigSql(
  metricSql: Record<string, string>,
  config: MetricFieldConfig,
): Record<string, string> {
  const metricRecord = isObject(config.metric)
    ? (config.metric as SavedMetricRecord)
    : undefined;
  const metricName =
    typeof config.metric === 'string'
      ? config.metric
      : metricRecord === undefined
        ? undefined
        : getSavedMetricName(metricRecord);
  const sqlExpression =
    getSqlMetricExpression(config.metric) ??
    (metricRecord === undefined
      ? undefined
      : getSavedMetricExpression(metricRecord));

  if (sqlExpression === undefined) {
    return metricSql;
  }

  const metricLabel = getMetricLabel(config.metric);
  const nextMetricSql = addMetricSql(metricSql, metricLabel, sqlExpression);
  const withConfigLabel = addMetricSql(
    nextMetricSql,
    config.label,
    sqlExpression,
  );

  return addMetricSql(withConfigLabel, metricName, sqlExpression);
}

function getMetricSqlMap(
  metricConfigs: MetricFieldConfig[],
  formData: CrosstabFormData,
  calculatedFields: CrosstabCalculatedField[],
): Record<string, string> {
  const datasourceMetricLookup = getDatasourceMetricLookup(formData);
  const referencedMetricIds = getReferencedMetricIds(calculatedFields);
  const explicitMetricSql = metricConfigs.reduce<Record<string, string>>(
    (metricSql, config) => addExplicitMetricConfigSql(metricSql, config),
    {},
  );
  const explicitMetricKeys = new Set(Object.keys(explicitMetricSql));
  const datasourceMetricSql = getDatasourceSavedMetrics(formData).reduce<
    Record<string, string>
  >((metricSql, metric) => {
    const sqlExpression = getSavedMetricExpression(metric);

    if (sqlExpression === undefined) {
      return metricSql;
    }

    return getSavedMetricNames(metric).reduce(
      (nextMetricSql, metricName) =>
        addDatasourceMetricSql(
          nextMetricSql,
          metricName,
          sqlExpression,
          referencedMetricIds,
          explicitMetricKeys,
        ),
      metricSql,
    );
  }, explicitMetricSql);

  return metricConfigs.reduce<Record<string, string>>(
    (metricSql, config) =>
      addMetricConfigSql(metricSql, config, datasourceMetricLookup),
    datasourceMetricSql,
  );
}

function isCalculatedFieldPlaceholder(
  config: MetricFieldConfig,
  calculatedFieldById: Map<string, CrosstabCalculatedField>,
): boolean {
  const field =
    config.calculatedFieldId === undefined
      ? undefined
      : calculatedFieldById.get(config.calculatedFieldId);

  return (
    field !== undefined &&
    typeof config.metric === 'string' &&
    getSqlMetricExpression(config.metric) === undefined &&
    (config.metric === field.id ||
      config.metric === field.name ||
      config.label === field.id ||
      config.label === field.name)
  );
}

function assertNoDuplicateFields(
  metricConfigs: MetricFieldConfig[],
  calculatedFields: CrosstabCalculatedField[],
): void {
  const labels = new Set<string>();
  const calculatedKeys = new Set<string>();

  metricConfigs.forEach(config => {
    labels.add(getMetricLabel(config.metric));
    if (config.label !== undefined) {
      labels.add(config.label);
    }
  });

  calculatedFields.forEach(field => {
    const id = field.id.trim();
    const name = field.name.trim();

    if (
      calculatedKeys.has(id) ||
      calculatedKeys.has(name) ||
      labels.has(id) ||
      labels.has(name)
    ) {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }

    calculatedKeys.add(id);
    calculatedKeys.add(name);
  });
}

function stripCalculatedFieldPlaceholders(
  metricConfigs: MetricFieldConfig[],
  calculatedFields: CrosstabCalculatedField[],
): MetricFieldConfig[] {
  const calculatedFieldById = new Map(
    calculatedFields.map(field => [field.id, field]),
  );

  return metricConfigs.filter(
    config => !isCalculatedFieldPlaceholder(config, calculatedFieldById),
  );
}

function calculatedMetric(
  field: CrosstabCalculatedField,
  sqlExpression: string,
): QueryFormMetric {
  return {
    expressionType: 'SQL',
    label: field.name,
    sqlExpression,
  };
}

function getCalculatedFieldSemantic(
  field: CrosstabCalculatedField,
): MetricFieldConfig['semantic'] {
  switch (field.resultType) {
    case 'percent':
    case 'ratio':
      return 'ratio';
    case 'number':
      return 'additive';
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
): CrosstabCalculatedField[] {
  try {
    assertNoLegacyV4Inputs(formData, ERR_CROSSTAB_CALC_FIELD);

    const parsed = parseCalculatedFields(formData.crosstabCalculatedFields);

    assertKnownParameterRefs(parsed, getCrosstabParameters(formData));

    return parsed;
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
    case 'literal_number':
      return;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function collectParameterRefs(
  node: CrosstabExpressionNode,
  parameterRefs: Set<string>,
): void {
  switch (node.kind) {
    case 'number_param':
      parameterRefs.add(node.parameterId);
      return;
    case 'binary_op':
      collectParameterRefs(node.left, parameterRefs);
      collectParameterRefs(node.right, parameterRefs);
      return;
    case 'safe_div':
    case 'pct':
    case 'ratio':
      collectParameterRefs(node.numerator, parameterRefs);
      collectParameterRefs(node.denominator, parameterRefs);
      return;
    case 'metric_ref':
    case 'literal_number':
      return;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function assertKnownParameterRefs(
  calculatedFields: CrosstabCalculatedField[],
  parameters: ReturnType<typeof getCrosstabParameters>,
): void {
  const parameterIds = new Set(parameters.map(parameter => parameter.id));

  calculatedFields.forEach(field => {
    const parameterRefs = new Set<string>();

    collectParameterRefs(field.ast, parameterRefs);

    parameterRefs.forEach(parameterId => {
      if (!parameterIds.has(parameterId)) {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
    });
  });
}

function getReferencedMetricIds(
  calculatedFields: CrosstabCalculatedField[],
): Set<string> {
  const referencedMetricIds = new Set<string>();

  calculatedFields.forEach(field => {
    collectMetricRefs(field.ast, referencedMetricIds);
  });

  return referencedMetricIds;
}

function assertNoRecursiveCalculatedFields(
  calculatedFields: CrosstabCalculatedField[],
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
  calculatedFields: CrosstabCalculatedField[];
  dialect: CalcSqlDialect;
  metricSql: Record<string, string>;
  parameterValues: Record<string, number>;
}): Record<string, string> {
  const fieldById = new Map(calculatedFields.map(field => [field.id, field]));
  const resolvedMetricSql = { ...metricSql };
  const resolving = new Set<string>();

  function resolveFieldSql(field: CrosstabCalculatedField): string {
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
  const metricSql = getMetricSqlMap(
    baseMetricConfigs,
    formData,
    calculatedFields,
  );

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
  calculatedFields: CrosstabCalculatedField[],
  parameterValues: Record<string, number>,
): string {
  return [
    stableSerialize(calculatedFields),
    `parameters:${stableSerialize(parameterValues)}`,
  ].join('|');
}
