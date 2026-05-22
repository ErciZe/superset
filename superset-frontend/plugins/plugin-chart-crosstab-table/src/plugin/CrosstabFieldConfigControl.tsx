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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  styled,
  t,
  type QueryFormColumn,
  type QueryFormMetric,
} from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import type { ColumnMeta, Metric } from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl';
import type {
  CrosstabFieldConfig,
  CrosstabFormData,
  DimensionFieldConfig,
  MetricFieldConfig,
  MetricSemantic,
  MetricSemanticOverride,
} from '../types';
import { getMetricSemanticLabel } from './metricSemantics';

const Zone = styled.div`
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ZoneHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

const FieldOptions = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const FieldOption = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${({ theme }) => theme.sizeUnit}px;
  align-items: center;
`;

const FieldLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SemanticSelect = styled.select`
  min-width: 120px;
`;

const CalculatedMetricList = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const CalculatedMetricChip = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.colorFillTertiary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;
  min-height: ${({ theme }) => theme.sizeUnit * 6}px;
  padding: 0 ${({ theme }) => theme.sizeUnit}px;
`;

const CalculatedMetricRemoveButton = styled.button`
  align-items: center;
  background: transparent;
  border: 0;
  color: ${({ theme }) => theme.colorIcon};
  cursor: pointer;
  display: flex;
  padding: 0;
`;

const OverrideGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const OverrideFieldInput = styled.input`
  width: 100%;
`;

const OverrideTextarea = styled.textarea`
  font-family: ${({ theme }) => theme.fontFamilyCode};
  min-height: 120px;
  width: 100%;
`;

const ErrorText = styled.div`
  color: ${({ theme }) => theme.colorError};
`;

const EMPTY_ACTIONS = {} as never;
const SEMANTIC_OPTIONS: MetricSemantic[] = [
  'unknown',
  'additive',
  'ratio',
  'average',
  'distinct',
];

type NormalizedCrosstabFieldConfig = {
  rows: DimensionFieldConfig[];
  columns: DimensionFieldConfig[];
  metrics: MetricFieldConfig[];
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides: MetricSemanticOverride[];
};

type CrosstabFieldConfigControlProps = {
  columns?: ColumnMeta[];
  datasource?: unknown;
  formData?: CrosstabFormData;
  label?: string;
  name: string;
  onChange: (value: CrosstabFieldConfig) => void;
  savedMetrics?: Metric[];
  value?: CrosstabFieldConfig;
};

function hasConfig(value?: CrosstabFieldConfig) {
  return Boolean(
    value &&
      ((value.rows?.length ?? 0) > 0 ||
        (value.columns?.length ?? 0) > 0 ||
        (value.metrics?.length ?? 0) > 0),
  );
}

function normalizeConfig(
  value?: CrosstabFieldConfig,
  formData?: CrosstabFormData,
): NormalizedCrosstabFieldConfig {
  if (hasConfig(value)) {
    return {
      rows: value?.rows ?? [],
      columns: value?.columns ?? [],
      metrics: value?.metrics ?? [],
      semanticOverrideField: value?.semanticOverrideField,
      semanticOverrides: value?.semanticOverrides ?? [],
    };
  }

  return {
    rows: ensureIsArray<QueryFormColumn>(formData?.groupbyRows).map(field => ({
      field,
    })),
    columns: ensureIsArray<QueryFormColumn>(formData?.groupbyColumns).map(
      field => ({ field }),
    ),
    metrics: ensureIsArray<QueryFormMetric>(formData?.metrics).map(metric => ({
      metric,
    })),
    semanticOverrideField: value?.semanticOverrideField,
    semanticOverrides: value?.semanticOverrides ?? [],
  };
}

function columnValues(fields: DimensionFieldConfig[]) {
  return fields.map(item => item.field);
}

function optionalColumnLabel(field?: QueryFormColumn) {
  return field ? getColumnLabel(field) : '';
}

function metricValues(fields: MetricFieldConfig[]) {
  return fields.map(item => item.metric);
}

function mergeDimensionItems(
  nextFields: QueryFormColumn[],
  previousFields: DimensionFieldConfig[],
) {
  return nextFields.map(field => {
    const key = getColumnLabel(field);
    const previous = previousFields.find(
      item => getColumnLabel(item.field) === key,
    );

    return previous ? { ...previous, field } : { field };
  });
}

function mergeMetricItems(
  nextMetrics: QueryFormMetric[],
  previousMetrics: MetricFieldConfig[],
) {
  return nextMetrics.map(metric => {
    const key = getMetricLabel(metric);
    const previous = previousMetrics.find(
      item => getMetricLabel(item.metric) === key,
    );

    return previous ? { ...previous, metric } : { metric };
  });
}

function isCalculatedMetricConfig(config: MetricFieldConfig) {
  return (
    typeof config.calculatedFieldId === 'string' &&
    config.calculatedFieldId.trim().length > 0
  );
}

function mergeMetricsPreservingCalculatedFields(
  nextRegularMetrics: MetricFieldConfig[],
  previousMetrics: MetricFieldConfig[],
) {
  const regularMetricQueue = [...nextRegularMetrics];
  const mergedMetrics: MetricFieldConfig[] = [];

  previousMetrics.forEach(metricConfig => {
    if (isCalculatedMetricConfig(metricConfig)) {
      mergedMetrics.push(metricConfig);
      return;
    }

    const nextMetric = regularMetricQueue.shift();
    if (nextMetric !== undefined) {
      mergedMetrics.push(nextMetric);
    }
  });

  return [...mergedMetrics, ...regularMetricQueue];
}

function formatSemanticOverrides(overrides: MetricSemanticOverride[]) {
  return overrides.length > 0 ? JSON.stringify(overrides, null, 2) : '';
}

function isMetricSemantic(value: unknown): value is MetricSemantic {
  return SEMANTIC_OPTIONS.includes(value as MetricSemantic);
}

function isSemanticOverrideValue(
  value: unknown,
): value is MetricSemanticOverride['value'] {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function parseSemanticOverrides(value: string): MetricSemanticOverride[] {
  const parsed = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid semantic overrides');
  }

  return parsed.map(item => {
    if (
      item === null ||
      typeof item !== 'object' ||
      !('value' in item) ||
      !isSemanticOverrideValue(item.value) ||
      !('semantic' in item) ||
      !isMetricSemantic(item.semantic)
    ) {
      throw new Error('Invalid semantic overrides');
    }

    return {
      value: item.value,
      semantic: item.semantic,
    };
  });
}

export default function CrosstabFieldConfigControl({
  columns = [],
  datasource,
  formData,
  name,
  onChange,
  savedMetrics = [],
  value,
}: CrosstabFieldConfigControlProps) {
  const config = useMemo(
    () => normalizeConfig(value, formData),
    [formData, value],
  );
  const [semanticOverridesText, setSemanticOverridesText] = useState(() =>
    formatSemanticOverrides(config.semanticOverrides),
  );
  const [semanticOverridesError, setSemanticOverridesError] = useState<
    string | undefined
  >();
  const calculatedMetricConfigs = useMemo(
    () => config.metrics.filter(isCalculatedMetricConfig),
    [config.metrics],
  );
  const regularMetricConfigs = useMemo(
    () => config.metrics.filter(item => !isCalculatedMetricConfig(item)),
    [config.metrics],
  );

  useEffect(() => {
    setSemanticOverridesText(formatSemanticOverrides(config.semanticOverrides));
    setSemanticOverridesError(undefined);
  }, [config.semanticOverrides]);

  const emit = useCallback(
    (nextConfig: NormalizedCrosstabFieldConfig) => {
      onChange(nextConfig);
    },
    [onChange],
  );
  const updateRows = useCallback(
    (nextFields: QueryFormColumn[] | QueryFormColumn | null | undefined) => {
      emit({
        ...config,
        rows: mergeDimensionItems(
          ensureIsArray<QueryFormColumn>(nextFields),
          config.rows,
        ),
      });
    },
    [config, emit],
  );
  const updateColumns = useCallback(
    (nextFields: QueryFormColumn[] | QueryFormColumn | null | undefined) => {
      emit({
        ...config,
        columns: mergeDimensionItems(
          ensureIsArray<QueryFormColumn>(nextFields),
          config.columns,
        ),
      });
    },
    [config, emit],
  );
  const updateMetrics = useCallback(
    (nextMetrics: QueryFormMetric[] | QueryFormMetric | null | undefined) => {
      const regularMetrics = mergeMetricItems(
        ensureIsArray<QueryFormMetric>(nextMetrics),
        regularMetricConfigs,
      );

      emit({
        ...config,
        metrics: mergeMetricsPreservingCalculatedFields(
          regularMetrics,
          config.metrics,
        ),
      });
    },
    [config, emit, regularMetricConfigs],
  );
  const removeCalculatedMetric = useCallback(
    (index: number) => {
      const target = calculatedMetricConfigs[index];

      emit({
        ...config,
        metrics: config.metrics.filter(item => item !== target),
      });
    },
    [calculatedMetricConfigs, config, emit],
  );
  const updateMetricSemantic = useCallback(
    (metric: QueryFormMetric, semantic: MetricSemantic) => {
      const key = getMetricLabel(metric);

      emit({
        ...config,
        metrics: config.metrics.map(item =>
          getMetricLabel(item.metric) === key ? { ...item, semantic } : item,
        ),
      });
    },
    [config, emit],
  );
  const updateSemanticOverrideField = useCallback(
    (semanticOverrideField: string | undefined) => {
      emit({
        ...config,
        semanticOverrideField: semanticOverrideField || undefined,
      });
    },
    [config, emit],
  );
  const updateSemanticOverrides = useCallback(
    (nextValue: string) => {
      setSemanticOverridesText(nextValue);

      if (!nextValue.trim()) {
        setSemanticOverridesError(undefined);
        emit({
          ...config,
          semanticOverrides: [],
        });
        return;
      }

      try {
        const semanticOverrides = parseSemanticOverrides(nextValue);
        setSemanticOverridesError(undefined);
        emit({
          ...config,
          semanticOverrides,
        });
      } catch {
        setSemanticOverridesError(t('Invalid JSON'));
      }
    },
    [config, emit],
  );
  const toggleSubtotal = useCallback(
    (field: QueryFormColumn) => {
      const key = getColumnLabel(field);

      emit({
        ...config,
        rows: config.rows.map(item =>
          getColumnLabel(item.field) === key
            ? { ...item, showSubtotal: item.showSubtotal === false }
            : item,
        ),
      });
    },
    [config, emit],
  );
  const renderDimensionOptions = useCallback(
    (area: 'rows' | 'columns') => {
      const options = config[area].flatMap((item, index) => {
        const fieldLabel = getColumnLabel(item.field);
        const canShowSubtotal =
          area === 'rows' && index < config.rows.length - 1;
        const subtotalId = `${name}-${area}-${index}-subtotal`;

        return canShowSubtotal
          ? [
              <FieldOption key={fieldLabel}>
                <FieldLabel title={fieldLabel}>{fieldLabel}</FieldLabel>
                <label htmlFor={subtotalId}>
                  <input
                    checked={item.showSubtotal !== false}
                    id={subtotalId}
                    type="checkbox"
                    onChange={() => toggleSubtotal(item.field)}
                  />{' '}
                  {t('Subtotal')}
                </label>
              </FieldOption>,
            ]
          : [];
      });

      return options.length > 0 ? <FieldOptions>{options}</FieldOptions> : null;
    },
    [config, name, toggleSubtotal],
  );
  const renderCalculatedMetricChips = useCallback(
    () =>
      calculatedMetricConfigs.length > 0 ? (
        <CalculatedMetricList data-test="crosstab-calculated-field-metrics">
          {calculatedMetricConfigs.map((item, index) => {
            const metricLabel = item.label ?? getMetricLabel(item.metric);

            return (
              <CalculatedMetricChip
                data-test="crosstab-calculated-field-metric"
                key={`${item.calculatedFieldId}-${index}`}
              >
                <CalculatedMetricRemoveButton
                  aria-label={t('Remove %s', metricLabel)}
                  type="button"
                  onClick={() => removeCalculatedMetric(index)}
                >
                  <Icons.CloseOutlined iconSize="m" />
                </CalculatedMetricRemoveButton>
                <FieldLabel title={metricLabel}>{metricLabel}</FieldLabel>
              </CalculatedMetricChip>
            );
          })}
        </CalculatedMetricList>
      ) : null,
    [calculatedMetricConfigs, removeCalculatedMetric],
  );
  const renderMetricOptions = useCallback(
    () => (
      <FieldOptions>
        {config.metrics.map(item => {
          const metricLabel = getMetricLabel(item.metric);

          return (
            <FieldOption key={metricLabel}>
              <FieldLabel title={metricLabel}>{metricLabel}</FieldLabel>
              <SemanticSelect
                aria-label={t('Metric semantic')}
                value={item.semantic ?? 'unknown'}
                onChange={event => {
                  if (isMetricSemantic(event.target.value)) {
                    updateMetricSemantic(item.metric, event.target.value);
                  }
                }}
              >
                {SEMANTIC_OPTIONS.map(semantic => (
                  <option key={semantic} value={semantic}>
                    {getMetricSemanticLabel(semantic)}
                  </option>
                ))}
              </SemanticSelect>
            </FieldOption>
          );
        })}
      </FieldOptions>
    ),
    [config.metrics, updateMetricSemantic],
  );
  const overrideFieldOptions = useMemo(
    () =>
      [...config.rows, ...config.columns].map(item =>
        getColumnLabel(item.field),
      ),
    [config.columns, config.rows],
  );
  const semanticOverrideFieldId = `${name}-semantic-override-field`;
  const semanticOverridesId = `${name}-semantic-overrides`;

  return (
    <div data-test="crosstab-field-config-control">
      <Zone data-test="crosstab-field-zone-rows">
        <ZoneHeader>{t('Rows')}</ZoneHeader>
        <DndColumnSelect
          actions={EMPTY_ACTIONS}
          multi
          name={`${name}-rows`}
          onChange={updateRows}
          options={columns}
          type="DndColumnSelect"
          value={columnValues(config.rows)}
        />
        {renderDimensionOptions('rows')}
      </Zone>
      <Zone data-test="crosstab-field-zone-columns">
        <ZoneHeader>{t('Columns')}</ZoneHeader>
        <DndColumnSelect
          actions={EMPTY_ACTIONS}
          multi
          name={`${name}-columns`}
          onChange={updateColumns}
          options={columns}
          type="DndColumnSelect"
          value={columnValues(config.columns)}
        />
        {renderDimensionOptions('columns')}
      </Zone>
      <Zone data-test="crosstab-field-zone-metrics">
        <ZoneHeader>{t('Metrics')}</ZoneHeader>
        {renderCalculatedMetricChips()}
        <DndMetricSelect
          columns={columns}
          datasource={datasource}
          multi
          name={`${name}-metrics`}
          onChange={updateMetrics}
          savedMetrics={savedMetrics}
          value={metricValues(regularMetricConfigs)}
        />
        {renderMetricOptions()}
      </Zone>
      <Zone data-test="crosstab-field-zone-semantic-overrides">
        <ZoneHeader>{t('Metric semantic overrides')}</ZoneHeader>
        <OverrideGrid>
          <label htmlFor={semanticOverrideFieldId}>
            {t('Semantic override field')}
            {overrideFieldOptions.length > 0 ? (
              <SemanticSelect
                aria-label={t('Semantic override field')}
                id={semanticOverrideFieldId}
                value={optionalColumnLabel(config.semanticOverrideField)}
                onChange={event =>
                  updateSemanticOverrideField(event.target.value)
                }
              >
                <option value="">{t('None')}</option>
                {overrideFieldOptions.map(field => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </SemanticSelect>
            ) : (
              <OverrideFieldInput
                aria-label={t('Semantic override field')}
                id={semanticOverrideFieldId}
                value={optionalColumnLabel(config.semanticOverrideField)}
                onChange={event =>
                  updateSemanticOverrideField(event.target.value)
                }
              />
            )}
          </label>
          <label htmlFor={semanticOverridesId}>
            {t('Semantic overrides')}
            <OverrideTextarea
              aria-label={t('Semantic overrides')}
              id={semanticOverridesId}
              value={semanticOverridesText}
              onChange={event => updateSemanticOverrides(event.target.value)}
            />
          </label>
          {semanticOverridesError && (
            <ErrorText>{semanticOverridesError}</ErrorText>
          )}
        </OverrideGrid>
      </Zone>
    </div>
  );
}
