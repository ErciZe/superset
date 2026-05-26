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
  getColumnLabel,
  getMetricLabel,
  type DataRecord,
  type QueryFormColumn,
  type QueryFormMetric,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import type {
  CrosstabRowValueSummaryConfig,
  MetricFieldConfig,
  MetricSemantic,
  MetricSemanticOverride,
} from '../types';

export const ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC =
  'Crosstab summaries require explicit metric semantics.';

type ResolveMetricSemanticArgs = {
  metric: QueryFormMetric;
  row?: DataRecord;
  metricConfigs?: MetricFieldConfig[];
  rowValueSummaries?: CrosstabRowValueSummaryConfig;
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};

type SummarySemanticRequirement = {
  metric: QueryFormMetric;
  semantic: MetricSemantic;
  summaryLabel?: string;
};

function getConfiguredSummarySemantics(
  metricConfigs: MetricFieldConfig[],
  semanticOverrides: MetricSemanticOverride[],
  rowValueSummaries?: CrosstabRowValueSummaryConfig,
) {
  return [
    ...metricConfigs.map(config => config.semantic),
    ...semanticOverrides.map(override => override.semantic),
    ...(rowValueSummaries?.values.map(value => value.semantic) ?? []),
  ];
}

export function resolveMetricSemantic({
  metric,
  row,
  metricConfigs = [],
  rowValueSummaries,
  semanticOverrideField,
  semanticOverrides = [],
}: ResolveMetricSemanticArgs): MetricSemantic {
  if (rowValueSummaries && row) {
    const summaryField = getColumnLabel(rowValueSummaries.field);
    const rowValue = summaryField ? row[summaryField] : undefined;
    const summary = rowValueSummaries.values.find(item =>
      Object.is(item.value, rowValue),
    );

    if (summary) {
      return summary.semantic;
    }
  }

  if (semanticOverrideField && row) {
    const overrideField = getColumnLabel(semanticOverrideField);
    const rowValue = overrideField ? row[overrideField] : undefined;
    const override = semanticOverrides.find(item =>
      Object.is(item.value, rowValue),
    );

    if (override) {
      return override.semantic;
    }
  }

  const metricLabel = getMetricLabel(metric);
  const metricConfig = metricConfigs.find(
    item => getMetricLabel(item.metric) === metricLabel,
  );

  return metricConfig?.semantic ?? 'unknown';
}

export function isSqlSummarySemantic(semantic: MetricSemantic) {
  return (
    semantic === 'ratio' || semantic === 'average' || semantic === 'distinct'
  );
}

export function getMetricSemanticLabel(semantic: MetricSemantic) {
  switch (semantic) {
    case 'unknown':
      return t('Unknown');
    case 'additive':
      return t('Additive');
    case 'ratio':
      return t('Ratio');
    case 'average':
      return t('Average');
    case 'distinct':
      return t('Distinct count');
    default:
      return semantic;
  }
}

export function hasConfiguredSummarySemantics(
  metricConfigs: MetricFieldConfig[],
  semanticOverrides: MetricSemanticOverride[],
  rowValueSummaries?: CrosstabRowValueSummaryConfig,
) {
  return getConfiguredSummarySemantics(
    metricConfigs,
    semanticOverrides,
    rowValueSummaries,
  ).some(semantic => semantic !== undefined);
}

export function hasSqlSummarySemanticConfig(
  metricConfigs: MetricFieldConfig[],
  semanticOverrides: MetricSemanticOverride[],
  rowValueSummaries?: CrosstabRowValueSummaryConfig,
) {
  return getConfiguredSummarySemantics(
    metricConfigs,
    semanticOverrides,
    rowValueSummaries,
  ).some(semantic => semantic !== undefined && isSqlSummarySemantic(semantic));
}

export function validateSummarySemantics(
  requirements: SummarySemanticRequirement[],
) {
  const unknownRequirement = requirements.find(
    item => item.semantic === 'unknown',
  );

  if (unknownRequirement) {
    const metricLabel = getMetricLabel(unknownRequirement.metric);
    const summaryLabel = unknownRequirement.summaryLabel
      ? ` ${unknownRequirement.summaryLabel}`
      : '';

    throw new Error(
      `${ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC} Metric: ${metricLabel}.${summaryLabel}`,
    );
  }
}
