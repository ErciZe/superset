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
import { useCallback, useMemo, useState } from 'react';
import {
  ensureIsArray,
  getMetricLabel,
  styled,
  t,
  type QueryFormMetric,
} from '@superset-ui/core';
import { Button, Drawer, Input, Select } from '@superset-ui/core/components';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import type {
  CrosstabFieldConfig,
  CrosstabFormData,
  CrosstabV4CalculatedField,
  MetricFieldConfig,
} from '../types';
import { getCalculatedFields } from './calcFields';

const Editor = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const DrawerBody = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

type SavedMetric = {
  expression?: string;
  label?: string;
  metric?: QueryFormMetric;
  metric_name?: string;
  sqlExpression?: string;
  sql_expression?: string;
  verbose_name?: string;
};

type MetricOption = {
  label: string;
  value: string;
  metric: QueryFormMetric;
};

type CalculatedFieldDraft = {
  editingFieldId?: string;
  fieldId: string;
  fieldName: string;
  numeratorMetric?: string;
  denominatorMetric?: string;
};

type CrosstabCalculatedFieldsControlProps = {
  actions?: {
    setControlValue?: (control: string, value: unknown) => void;
  };
  formData?: CrosstabFormData;
  hovered?: boolean;
  label?: string;
  name: string;
  onChange: (value: CrosstabV4CalculatedField[]) => void;
  onControlChange?: (control: string, value: unknown) => void;
  savedMetrics?: SavedMetric[];
  value?: CrosstabV4CalculatedField[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getSavedMetricName(metric: SavedMetric): string | undefined {
  return (
    nonEmptyString(metric.metric_name) ??
    nonEmptyString(metric.label) ??
    nonEmptyString(metric.verbose_name)
  );
}

function getSavedMetricExpression(metric: SavedMetric): string | undefined {
  return (
    nonEmptyString(metric.expression) ??
    nonEmptyString(metric.sqlExpression) ??
    nonEmptyString(metric.sql_expression)
  );
}

function metricFromSavedMetric(
  metric: SavedMetric,
): QueryFormMetric | undefined {
  if (metric.metric) {
    return metric.metric;
  }

  const metricName = getSavedMetricName(metric);
  const sqlExpression = getSavedMetricExpression(metric);

  if (!metricName) {
    return undefined;
  }

  if (sqlExpression) {
    return {
      expressionType: 'SQL',
      label: metricName,
      sqlExpression,
    };
  }

  return undefined;
}

function getSavedMetricLookup(savedMetrics: SavedMetric[]) {
  return new Map(
    savedMetrics.flatMap(metric => {
      const metricName = getSavedMetricName(metric);
      const metricValue = metricFromSavedMetric(metric);

      return metricName && metricValue ? [[metricName, metricValue]] : [];
    }),
  );
}

function metricOptionFromMetric(
  metric: QueryFormMetric,
  label?: string,
  savedMetricLookup?: Map<string, QueryFormMetric>,
): MetricOption | undefined {
  if (typeof metric === 'string') {
    const savedMetric = savedMetricLookup?.get(metric);

    return savedMetric
      ? {
          label: label ?? metric,
          value: metric,
          metric: savedMetric,
        }
      : undefined;
  }

  if (isRecord(metric) && nonEmptyString(metric.metric_name)) {
    const metricName = nonEmptyString(metric.metric_name) as string;
    const savedMetric =
      getSavedMetricExpression(metric as SavedMetric) === undefined
        ? savedMetricLookup?.get(metricName)
        : metricFromSavedMetric(metric as SavedMetric);

    return savedMetric
      ? {
          label:
            label ??
            nonEmptyString(metric.verbose_name) ??
            nonEmptyString(metric.label) ??
            metricName,
          value: metricName,
          metric: savedMetric,
        }
      : undefined;
  }

  if (isRecord(metric)) {
    const metricLabel = getMetricLabel(metric);

    if (!metricLabel) {
      return undefined;
    }

    return {
      label: label ?? metricLabel,
      value: metricLabel,
      metric,
    };
  }

  return undefined;
}

function metricOptionFromConfig(
  metricConfig: SavedMetric,
  savedMetricLookup: Map<string, QueryFormMetric>,
): MetricOption | undefined {
  const metric = metricFromSavedMetric(metricConfig);

  return metric
    ? metricOptionFromMetric(
        metric,
        metricConfig.label ?? metricConfig.verbose_name,
        savedMetricLookup,
      )
    : undefined;
}

function getMetricOptions(
  formData: CrosstabFormData | undefined,
  savedMetrics: SavedMetric[],
): MetricOption[] {
  const fieldMetrics = formData?.crosstabFieldConfig?.metrics ?? [];
  const savedMetricLookup = getSavedMetricLookup(savedMetrics);

  const selectedMetricOptions = fieldMetrics
    .filter(metricConfig => metricConfig.calculatedFieldId === undefined)
    .map(metricConfig =>
      metricOptionFromMetric(
        metricConfig.metric,
        metricConfig.label,
        savedMetricLookup,
      ),
    )
    .filter((option): option is MetricOption => option !== undefined);

  if (selectedMetricOptions.length > 0) {
    return selectedMetricOptions;
  }

  const legacyMetrics = ensureIsArray<QueryFormMetric>(formData?.metrics);
  const legacyMetricOptions = legacyMetrics
    .map(metric =>
      metricOptionFromMetric(metric, undefined, savedMetricLookup),
    )
    .filter((option): option is MetricOption => option !== undefined);

  if (legacyMetricOptions.length > 0) {
    return legacyMetricOptions;
  }

  return savedMetrics
    .map(metric => metricOptionFromConfig(metric, savedMetricLookup))
    .filter((option): option is MetricOption => option !== undefined);
}

function getFieldConfig(formData?: CrosstabFormData): CrosstabFieldConfig {
  return formData?.crosstabFieldConfig ?? {};
}

function getSelectedMetricValue(
  selectedValue: string | undefined,
  metricOptions: MetricOption[],
  fallbackIndex: number,
): string | undefined {
  if (
    selectedValue !== undefined &&
    metricOptions.some(option => option.value === selectedValue)
  ) {
    return selectedValue;
  }

  return metricOptions[fallbackIndex]?.value;
}

function validateCalculatedFields(
  nextValue: CrosstabV4CalculatedField[],
): void {
  getCalculatedFields({
    viz_type: 'crosstab-table',
    datasource: '0__table',
    crosstabCalculatedFields: nextValue,
  } as CrosstabFormData);
}

function pctMetricRef(
  field: CrosstabV4CalculatedField,
  role: 'numerator' | 'denominator',
): string | undefined {
  if (field.ast.kind !== 'pct') {
    return undefined;
  }

  const node = field.ast[role];

  return node.kind === 'metric_ref' ? node.metricId : undefined;
}

function calculatedMetricConfig(
  field: CrosstabV4CalculatedField,
): MetricFieldConfig {
  return {
    metric: field.name,
    label: field.name,
    calculatedFieldId: field.id,
    semantic: 'ratio',
    formatString: field.formatString,
  };
}

function getMetricConfigLabel(config: MetricFieldConfig): string {
  return config.label ?? getMetricLabel(config.metric);
}

function getNextCalculatedFields(
  value: CrosstabV4CalculatedField[],
  field: CrosstabV4CalculatedField,
  editingFieldId?: string,
): CrosstabV4CalculatedField[] {
  if (editingFieldId === undefined) {
    return [...value, field];
  }

  const existingIndex = value.findIndex(
    existingField => existingField.id === editingFieldId,
  );

  if (existingIndex >= 0) {
    return value.map((existingField, index) =>
      index === existingIndex ? field : existingField,
    );
  }

  return [...value, field];
}

function assertUniqueCalculatedField(
  value: CrosstabV4CalculatedField[],
  field: CrosstabV4CalculatedField,
  fieldConfig: CrosstabFieldConfig,
  editingFieldId?: string,
): void {
  const hasCalculatedFieldConflict = value.some(
    existingField =>
      existingField.id !== editingFieldId &&
      (existingField.id === field.id ||
        existingField.id === field.name ||
        existingField.name === field.id ||
        existingField.name === field.name),
  );
  const hasMetricConflict = (fieldConfig.metrics ?? []).some(
    metricConfig =>
      metricConfig.calculatedFieldId === undefined &&
      [field.id, field.name].includes(getMetricConfigLabel(metricConfig)),
  );

  if (hasCalculatedFieldConflict || hasMetricConflict) {
    throw new Error(t('Calculated field ids and names must be unique.'));
  }
}

function syncCalculatedMetricConfig(
  fieldConfig: CrosstabFieldConfig,
  field: CrosstabV4CalculatedField,
  editingFieldId?: string,
): CrosstabFieldConfig {
  const targetId = editingFieldId ?? field.id;
  const metrics = fieldConfig.metrics ?? [];
  const nextMetricConfig = calculatedMetricConfig(field);
  let didInsert = false;
  const nextMetrics = metrics.flatMap(metricConfig => {
    if (metricConfig.calculatedFieldId !== targetId) {
      return [metricConfig];
    }

    if (didInsert) {
      return [];
    }

    didInsert = true;
    return [nextMetricConfig];
  });

  return {
    ...fieldConfig,
    metrics: didInsert ? nextMetrics : [...nextMetrics, nextMetricConfig],
  };
}

function removeCalculatedMetricConfig(
  fieldConfig: CrosstabFieldConfig,
  fieldId: string,
): CrosstabFieldConfig {
  return {
    ...fieldConfig,
    metrics: (fieldConfig.metrics ?? []).filter(
      metricConfig => metricConfig.calculatedFieldId !== fieldId,
    ),
  };
}

export default function CrosstabCalculatedFieldsControl({
  actions,
  formData,
  hovered,
  label,
  name,
  onChange,
  onControlChange,
  savedMetrics = [],
  value = [],
}: CrosstabCalculatedFieldsControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const metricOptions = useMemo(
    () => getMetricOptions(formData, savedMetrics),
    [formData, savedMetrics],
  );
  const [draft, setDraft] = useState<CalculatedFieldDraft>({
    fieldId: 'profitRate',
    fieldName: t('Profit rate'),
  });

  const resolvedNumeratorMetric = getSelectedMetricValue(
    draft.numeratorMetric,
    metricOptions,
    0,
  );
  const resolvedDenominatorMetric = getSelectedMetricValue(
    draft.denominatorMetric,
    metricOptions,
    1,
  );
  const selectedNumeratorMetric = metricOptions.find(
    option => option.value === resolvedNumeratorMetric,
  );
  const selectedDenominatorMetric = metricOptions.find(
    option => option.value === resolvedDenominatorMetric,
  );

  const saveField = useCallback(() => {
    const setControlValue = onControlChange ?? actions?.setControlValue;

    if (!setControlValue) {
      throw new Error(
        t('Calculated fields require crosstab field config updates.'),
      );
    }

    if (!selectedNumeratorMetric || !selectedDenominatorMetric) {
      throw new Error(t('Calculated fields require two saved metrics.'));
    }

    const field: CrosstabV4CalculatedField = {
      id: draft.fieldId.trim(),
      name: draft.fieldName.trim(),
      resultType: 'percent',
      formatString: '.2%',
      ast: {
        kind: 'pct',
        numerator: {
          kind: 'metric_ref',
          metricId: selectedNumeratorMetric.value,
        },
        denominator: {
          kind: 'metric_ref',
          metricId: selectedDenominatorMetric.value,
        },
      },
    };
    const currentFieldConfig = getFieldConfig(formData);
    const nextValue = getNextCalculatedFields(
      value,
      field,
      draft.editingFieldId,
    );
    const nextFieldConfig = syncCalculatedMetricConfig(
      currentFieldConfig,
      field,
      draft.editingFieldId,
    );

    assertUniqueCalculatedField(
      value,
      field,
      currentFieldConfig,
      draft.editingFieldId,
    );
    validateCalculatedFields(nextValue);
    onChange(nextValue);
    setControlValue('crosstabFieldConfig', nextFieldConfig);
    setIsOpen(false);
    setDraft({
      fieldId: 'profitRate',
      fieldName: t('Profit rate'),
    });
  }, [
    actions,
    draft,
    formData,
    onChange,
    onControlChange,
    selectedDenominatorMetric,
    selectedNumeratorMetric,
    value,
  ]);

  const deleteField = useCallback(
    (fieldId: string) => {
      const setControlValue = onControlChange ?? actions?.setControlValue;

      if (!setControlValue) {
        throw new Error(
          t('Calculated fields require crosstab field config updates.'),
        );
      }

      const nextValue = value.filter(field => field.id !== fieldId);
      const nextFieldConfig = removeCalculatedMetricConfig(
        getFieldConfig(formData),
        fieldId,
      );

      validateCalculatedFields(nextValue);
      onChange(nextValue);
      setControlValue('crosstabFieldConfig', nextFieldConfig);
      setDraft(currentDraft =>
        currentDraft.editingFieldId === fieldId
          ? { fieldId: 'profitRate', fieldName: t('Profit rate') }
          : currentDraft,
      );
      setIsOpen(false);
    },
    [actions, formData, onChange, onControlChange, value],
  );

  return (
    <Editor data-test="crosstab-calculated-fields-control">
      <ControlHeader
        hovered={hovered}
        label={label}
        name={name}
        renderTrigger
      />
      <Button
        buttonSize="small"
        buttonStyle="secondary"
        onClick={() => {
          setDraft({
            fieldId: 'profitRate',
            fieldName: t('Profit rate'),
          });
          setIsOpen(true);
        }}
      >
        {t('New calculated field')}
      </Button>
      {value.map(field => (
        <div key={field.id}>
          <span>{field.name}</span>
          <Button
            buttonSize="small"
            onClick={() => {
              setDraft({
                editingFieldId: field.id,
                fieldId: field.id,
                fieldName: field.name,
                numeratorMetric: pctMetricRef(field, 'numerator'),
                denominatorMetric: pctMetricRef(field, 'denominator'),
              });
              setIsOpen(true);
            }}
          >
            {t('Edit')}
          </Button>
          <Button buttonSize="small" onClick={() => deleteField(field.id)}>
            {t('Delete')}
          </Button>
        </div>
      ))}
      <Drawer
        onClose={() => setIsOpen(false)}
        open={isOpen}
        placement="right"
        title={t('Calculated field')}
      >
        <DrawerBody>
          <Field>
            {t('Id')}
            <Input
              aria-label={t('Calculated field id')}
              value={draft.fieldId}
              onChange={event =>
                setDraft(currentDraft => ({
                  ...currentDraft,
                  fieldId: event.target.value,
                }))
              }
            />
          </Field>
          <Field>
            {t('Name')}
            <Input
              aria-label={t('Calculated field name')}
              value={draft.fieldName}
              onChange={event =>
                setDraft(currentDraft => ({
                  ...currentDraft,
                  fieldName: event.target.value,
                }))
              }
            />
          </Field>
          <Field>
            {t('Numerator metric')}
            <Select
              ariaLabel={t('Numerator metric')}
              allowSelectAll={false}
              options={metricOptions}
              value={resolvedNumeratorMetric}
              onChange={nextMetric =>
                setDraft(currentDraft => ({
                  ...currentDraft,
                  numeratorMetric: String(nextMetric),
                }))
              }
            />
          </Field>
          <Field>
            {t('Denominator metric')}
            <Select
              ariaLabel={t('Denominator metric')}
              allowSelectAll={false}
              options={metricOptions}
              value={resolvedDenominatorMetric}
              onChange={nextMetric =>
                setDraft(currentDraft => ({
                  ...currentDraft,
                  denominatorMetric: String(nextMetric),
                }))
              }
            />
          </Field>
          <Button buttonSize="small" buttonStyle="primary" onClick={saveField}>
            {t('Save calculated field')}
          </Button>
        </DrawerBody>
      </Drawer>
    </Editor>
  );
}
