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
  CrosstabCalculatedField,
  CrosstabCalculatedFieldTemplate,
  CrosstabFieldConfig,
  CrosstabFormData,
  MetricFieldConfig,
  MetricSemantic,
} from '../types';

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

const SqlPreview = styled.pre`
  white-space: pre-wrap;
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
  onChange: (value: CrosstabCalculatedField[]) => void;
  savedMetrics?: SavedMetric[];
  value?: CrosstabCalculatedField[];
};

const templates: {
  label: string;
  value: CrosstabCalculatedFieldTemplate;
}[] = [
  { label: '比率', value: 'ratio' },
  { label: '差值', value: 'difference' },
  { label: '含参比率', value: 'parameterized_ratio' },
];

const templateValues: ReadonlySet<string> = new Set(
  templates.map(template => template.value),
);

function isCalculatedFieldTemplate(
  value: unknown,
): value is CrosstabCalculatedFieldTemplate {
  return typeof value === 'string' && templateValues.has(value);
}

function metricOptionFromMetric(
  metric: QueryFormMetric,
  label?: string,
): MetricOption | undefined {
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
  const metric =
    metricConfig.metric ?? metricConfig.metric_name ?? metricConfig.label;

  if (!metric) {
    return undefined;
  }

  const queryMetric = metric as QueryFormMetric;
  const metricLabel = getMetricLabel(queryMetric);

  return {
    label: metricConfig.label ?? metricConfig.verbose_name ?? metricLabel,
    value: metricLabel,
    metric: queryMetric,
  };
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

function getSemantic(
  template: CrosstabCalculatedFieldTemplate,
): MetricSemantic {
  return template === 'difference' ? 'additive' : 'ratio';
}

function getSqlPreview(
  template: CrosstabCalculatedFieldTemplate,
  leftMetric?: string,
  rightMetric?: string,
) {
  const left = leftMetric || '<metric_a>';
  const right = rightMetric || '<metric_b>';

  if (template === 'difference') {
    return `${left} - ${right}`;
  }

  if (template === 'parameterized_ratio') {
    return `(${left} / NULLIF(${right}, 0)) * {{ adjustmentRate }}`;
  }

  return `${left} / NULLIF(${right}, 0)`;
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

export default function CrosstabCalculatedFieldsControl({
  actions,
  formData,
  hovered,
  label,
  name,
  onChange,
  savedMetrics = [],
  value = [],
}: CrosstabCalculatedFieldsControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const metricOptions = useMemo(
    () => getMetricOptions(formData, savedMetrics),
    [formData, savedMetrics],
  );
  const [fieldLabel, setFieldLabel] = useState('含参毛利率');
  const [template, setTemplate] = useState<CrosstabCalculatedFieldTemplate>(
    'parameterized_ratio',
  );
  const [leftMetric, setLeftMetric] = useState<string | undefined>(
    metricOptions[0]?.value,
  );
  const [rightMetric, setRightMetric] = useState<string | undefined>(
    metricOptions[1]?.value,
  );
  const resolvedLeftMetric = getSelectedMetricValue(
    leftMetric,
    metricOptions,
    0,
  );
  const resolvedRightMetric = getSelectedMetricValue(
    rightMetric,
    metricOptions,
    1,
  );

  const selectedLeftMetric = metricOptions.find(
    option => option.value === resolvedLeftMetric,
  );
  const selectedRightMetric = metricOptions.find(
    option => option.value === resolvedRightMetric,
  );

  const saveField = useCallback(() => {
    const setControlValue = actions?.setControlValue;

    if (!setControlValue) {
      throw new Error(
        t('Calculated fields require crosstab field config updates.'),
      );
    }

    if (!selectedLeftMetric || !selectedRightMetric) {
      throw new Error(t('Calculated fields require two saved metrics.'));
    }

    const semantic = getSemantic(template);
    const field: CrosstabCalculatedField = {
      id: fieldLabel,
      label: fieldLabel,
      template,
      inputs: {
        leftMetric: selectedLeftMetric.metric,
        rightMetric: selectedRightMetric.metric,
        ...(template === 'parameterized_ratio'
          ? { parameterName: 'adjustmentRate' }
          : {}),
      },
      semantic,
      ...(template === 'difference' ? {} : { formatString: '.2%' }),
    };
    const nextValue = [...value, field];
    const nextMetricConfig: MetricFieldConfig = {
      metric: field.label as QueryFormMetric,
      label: field.label,
      semantic,
      calculatedFieldId: field.id,
      ...(field.formatString ? { formatString: field.formatString } : {}),
    };
    const currentFieldConfig = getFieldConfig(formData);
    const nextFieldConfig: CrosstabFieldConfig = {
      ...currentFieldConfig,
      metrics: [...(currentFieldConfig.metrics ?? []), nextMetricConfig],
    };

    onChange(nextValue);
    setControlValue('crosstabFieldConfig', nextFieldConfig);
    setIsOpen(false);
  }, [
    actions,
    fieldLabel,
    formData,
    onChange,
    selectedLeftMetric,
    selectedRightMetric,
    template,
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
            {t('Name')}
            <Input
              aria-label={t('Calculated field name')}
              value={fieldLabel}
              onChange={event => setFieldLabel(event.target.value)}
            />
          </Field>
          <Field>
            {t('Template')}
            <Select
              ariaLabel={t('Calculated field template')}
              allowSelectAll={false}
              options={templates}
              value={template}
              onChange={nextTemplate => {
                if (!isCalculatedFieldTemplate(nextTemplate)) {
                  throw new Error(t('Unsupported calculated field template.'));
                }

                setTemplate(nextTemplate);
              }}
            />
          </Field>
          <Field>
            {t('Metric A')}
            <Select
              ariaLabel={t('Metric A')}
              allowSelectAll={false}
              options={metricOptions}
              value={resolvedLeftMetric}
              onChange={nextMetric => setLeftMetric(String(nextMetric))}
            />
          </Field>
          <Field>
            {t('Metric B')}
            <Select
              ariaLabel={t('Metric B')}
              allowSelectAll={false}
              options={metricOptions}
              value={resolvedRightMetric}
              onChange={nextMetric => setRightMetric(String(nextMetric))}
            />
          </Field>
          <SqlPreview data-test="crosstab-calculated-field-sql-preview">
            {getSqlPreview(template, resolvedLeftMetric, resolvedRightMetric)}
          </SqlPreview>
          <Button buttonSize="small" buttonStyle="primary" onClick={saveField}>
            {t('Save')}
          </Button>
        </DrawerBody>
      </Drawer>
    </Editor>
  );
}
