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
  label?: string;
  metric?: QueryFormMetric;
  metric_name?: string;
  verbose_name?: string;
};

type MetricOption = {
  label: string;
  value: string;
  metric: QueryFormMetric;
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

function metricOptionFromMetric(
  metric: QueryFormMetric,
  label?: string,
): MetricOption | undefined {
  if (
    typeof metric !== 'object' ||
    metric === null ||
    Array.isArray(metric) ||
    metric.expressionType !== 'SQL' ||
    typeof metric.sqlExpression !== 'string'
  ) {
    return undefined;
  }

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

function metricOptionFromConfig(
  metricConfig: SavedMetric,
): MetricOption | undefined {
  if (!metricConfig.metric) {
    return undefined;
  }

  return metricOptionFromMetric(
    metricConfig.metric,
    metricConfig.label ?? metricConfig.verbose_name,
  );
}

function getMetricOptions(
  formData: CrosstabFormData | undefined,
  savedMetrics: SavedMetric[],
): MetricOption[] {
  const fieldMetrics = formData?.crosstabFieldConfig?.metrics ?? [];

  if (fieldMetrics.length > 0) {
    return fieldMetrics
      .map(metricConfig =>
        metricOptionFromMetric(metricConfig.metric, metricConfig.label),
      )
      .filter((option): option is MetricOption => option !== undefined);
  }

  const legacyMetrics = ensureIsArray<QueryFormMetric>(formData?.metrics);

  if (legacyMetrics.length > 0) {
    return legacyMetrics
      .map(metric => metricOptionFromMetric(metric))
      .filter((option): option is MetricOption => option !== undefined);
  }

  return savedMetrics
    .map(metricOptionFromConfig)
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

function validateCalculatedFields(nextValue: CrosstabV4CalculatedField[]): void {
  getCalculatedFields({
    viz_type: 'crosstab-table',
    datasource: '0__table',
    crosstabCalculatedFields: nextValue,
  } as CrosstabFormData);
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
  const [fieldId, setFieldId] = useState('profitRate');
  const [fieldName, setFieldName] = useState(t('Profit rate'));
  const [numeratorMetric, setNumeratorMetric] = useState<string | undefined>(
    metricOptions[0]?.value,
  );
  const [denominatorMetric, setDenominatorMetric] = useState<
    string | undefined
  >(metricOptions[1]?.value);

  const resolvedNumeratorMetric = getSelectedMetricValue(
    numeratorMetric,
    metricOptions,
    0,
  );
  const resolvedDenominatorMetric = getSelectedMetricValue(
    denominatorMetric,
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
      id: fieldId.trim(),
      name: fieldName.trim(),
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
    const nextValue = [...value, field];
    const nextMetricConfig: MetricFieldConfig = {
      metric: field.name,
      label: field.name,
      calculatedFieldId: field.id,
      semantic: 'ratio',
      formatString: field.formatString,
    };
    const currentFieldConfig = getFieldConfig(formData);
    const nextFieldConfig: CrosstabFieldConfig = {
      ...currentFieldConfig,
      metrics: [...(currentFieldConfig.metrics ?? []), nextMetricConfig],
    };

    validateCalculatedFields(nextValue);
    onChange(nextValue);
    setControlValue('crosstabFieldConfig', nextFieldConfig);
    setIsOpen(false);
  }, [
    actions,
    fieldId,
    fieldName,
    formData,
    onChange,
    onControlChange,
    selectedDenominatorMetric,
    selectedNumeratorMetric,
    value,
  ]);

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
        onClick={() => setIsOpen(true)}
      >
        {t('New calculated field')}
      </Button>
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
              value={fieldId}
              onChange={event => setFieldId(event.target.value)}
            />
          </Field>
          <Field>
            {t('Name')}
            <Input
              aria-label={t('Calculated field name')}
              value={fieldName}
              onChange={event => setFieldName(event.target.value)}
            />
          </Field>
          <Field>
            {t('Numerator metric')}
            <Select
              ariaLabel={t('Numerator metric')}
              allowSelectAll={false}
              options={metricOptions}
              value={resolvedNumeratorMetric}
              onChange={nextMetric => setNumeratorMetric(String(nextMetric))}
            />
          </Field>
          <Field>
            {t('Denominator metric')}
            <Select
              ariaLabel={t('Denominator metric')}
              allowSelectAll={false}
              options={metricOptions}
              value={resolvedDenominatorMetric}
              onChange={nextMetric => setDenominatorMetric(String(nextMetric))}
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
