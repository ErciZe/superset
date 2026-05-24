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
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  type QueryFormColumn,
  type QueryFormMetric,
} from '@superset-ui/core';
import type {
  CrosstabFieldConfig,
  CrosstabFormData,
  CrosstabRowValueSummaryConfig,
  DimensionFieldConfig,
  MetricFieldConfig,
} from '../types';
import { hasCanonicalV4Definitions } from './v4Contract';

export const ERR_CROSSTAB_V4_METRIC_CONFIG = 'ERR_CROSSTAB_V4_METRIC_CONFIG';

function hasFieldConfig(config?: CrosstabFieldConfig) {
  return Boolean(
    config &&
      ((config.rows?.length ?? 0) > 0 ||
        (config.columns?.length ?? 0) > 0 ||
        (config.metrics?.length ?? 0) > 0),
  );
}

export function getCrosstabRowConfigs(
  formData: CrosstabFormData,
): DimensionFieldConfig[] {
  return hasFieldConfig(formData.crosstabFieldConfig)
    ? formData.crosstabFieldConfig?.rows ?? []
    : ensureIsArray<QueryFormColumn>(formData.groupbyRows).map(field => ({
        field,
      }));
}

export function getCrosstabColumnConfigs(
  formData: CrosstabFormData,
): DimensionFieldConfig[] {
  return hasFieldConfig(formData.crosstabFieldConfig)
    ? formData.crosstabFieldConfig?.columns ?? []
    : ensureIsArray<QueryFormColumn>(formData.groupbyColumns).map(field => ({
        field,
      }));
}

export function getCrosstabRowColumns(formData: CrosstabFormData) {
  return getCrosstabRowConfigs(formData).map(item => item.field);
}

export function getCrosstabColumnColumns(formData: CrosstabFormData) {
  return getCrosstabColumnConfigs(formData).map(item => item.field);
}

export function getCrosstabMetrics(formData: CrosstabFormData) {
  return hasFieldConfig(formData.crosstabFieldConfig)
    ? (formData.crosstabFieldConfig?.metrics ?? []).map(item => item.metric)
    : ensureIsArray<QueryFormMetric>(formData.metrics);
}

export function getPersistedCrosstabMetricConfigs(
  formData: CrosstabFormData,
): MetricFieldConfig[] {
  return formData.crosstabFieldConfig?.metrics ?? [];
}

export function getEffectiveCrosstabMetricConfigs(
  formData: CrosstabFormData,
): MetricFieldConfig[] {
  const persistedMetricConfigs = getPersistedCrosstabMetricConfigs(formData);

  if (persistedMetricConfigs.length > 0) {
    return persistedMetricConfigs;
  }

  if (hasCanonicalV4Definitions(formData)) {
    throw new Error(ERR_CROSSTAB_V4_METRIC_CONFIG);
  }

  return ensureIsArray<QueryFormMetric>(formData.metrics).map(metric => ({
    metric,
  }));
}

export function getCrosstabMetricConfigs(formData: CrosstabFormData) {
  return getPersistedCrosstabMetricConfigs(formData);
}

export function getCrosstabSemanticOverrideField(formData: CrosstabFormData) {
  return formData.crosstabFieldConfig?.semanticOverrideField;
}

export function getCrosstabSemanticOverrides(formData: CrosstabFormData) {
  return formData.crosstabFieldConfig?.semanticOverrides ?? [];
}

export function getCrosstabRowValueSummaries(
  formData: CrosstabFormData,
): CrosstabRowValueSummaryConfig | undefined {
  return formData.crosstabFieldConfig?.rowValueSummaries;
}

export function getCrosstabFieldLabels(formData: CrosstabFormData) {
  if (!hasFieldConfig(formData.crosstabFieldConfig)) {
    return {};
  }

  return {
    ...(formData.crosstabFieldConfig?.rows ?? []).reduce<
      Record<string, string>
    >((labels, item) => {
      const key = getColumnLabel(item.field);
      return key && item.label ? { ...labels, [key]: item.label } : labels;
    }, {}),
    ...(formData.crosstabFieldConfig?.columns ?? []).reduce<
      Record<string, string>
    >((labels, item) => {
      const key = getColumnLabel(item.field);
      return key && item.label ? { ...labels, [key]: item.label } : labels;
    }, {}),
    ...(formData.crosstabFieldConfig?.metrics ?? []).reduce<
      Record<string, string>
    >((labels, item) => {
      const key = getMetricLabel(item.metric);
      return key && item.label ? { ...labels, [key]: item.label } : labels;
    }, {}),
  };
}

export function getCrosstabRowSubtotalDepths(formData: CrosstabFormData) {
  if (!hasFieldConfig(formData.crosstabFieldConfig)) {
    return undefined;
  }

  const rows = formData.crosstabFieldConfig?.rows ?? [];
  return rows
    .slice(0, -1)
    .flatMap((item, index) => (item.showSubtotal === false ? [] : [index + 1]));
}
