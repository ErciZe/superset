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
  type QueryFormMetric,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Button, Drawer, Input, Select } from '@superset-ui/core/components';
import type {
  CrosstabCalculatedField,
  CrosstabFieldConfig,
  CrosstabFormData,
  MetricFieldConfig,
} from '../types';
import {
  astToDraft,
  createExpressionDraft,
  draftToAst,
  duplicateCalculatedField,
  previewExpression,
  validateExpressionDraft,
  type ExpressionDraft,
  type ExpressionPreviewLabels,
} from './calc/builder';
import { getCalculatedFields } from './calcFields';
import { ControlHeader } from './controlAdapters';
import { getCrosstabParameters } from './parameters';
import { hasCanonicalV4Definitions } from './v4Contract';

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

type ParameterOption = {
  label: string;
  value: string;
};

type CalculatedFieldDraft = {
  description: string;
  editingFieldId?: string;
  fieldId: string;
  fieldName: string;
  expression: ExpressionDraft;
  formatString: string;
  resultType: CrosstabCalculatedField['resultType'];
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
  onControlChange?: (control: string, value: unknown) => void;
  savedMetrics?: SavedMetric[];
  value?: CrosstabCalculatedField[];
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

function getSavedMetricNames(metric: SavedMetric): string[] {
  return [
    nonEmptyString(metric.metric_name),
    nonEmptyString(metric.label),
    nonEmptyString(metric.verbose_name),
  ].filter((name): name is string => name !== undefined);
}

function getSavedMetricExpression(metric: SavedMetric): string | undefined {
  return (
    nonEmptyString(metric.expression) ??
    nonEmptyString(metric.sqlExpression) ??
    nonEmptyString(metric.sql_expression)
  );
}

function isSqlMetric(metric: QueryFormMetric): boolean {
  return (
    isRecord(metric) &&
    metric.expressionType === 'SQL' &&
    nonEmptyString(metric.sqlExpression) !== undefined
  );
}

function metricFromSavedMetric(
  metric: SavedMetric,
): QueryFormMetric | undefined {
  if (metric.metric && isSqlMetric(metric.metric)) {
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
      const metricValue = metricFromSavedMetric(metric);

      return metricValue
        ? getSavedMetricNames(metric).map(metricName => [
            metricName,
            metricValue,
          ])
        : [];
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

    return {
      label: label ?? metric,
      value: metric,
      metric: savedMetric ?? metric,
    };
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

  const legacyMetricOptions = hasCanonicalV4Definitions(
    formData ??
      ({ datasource: '0__table', viz_type: 'crosstab-table' } as never),
  )
    ? []
    : ensureIsArray<QueryFormMetric>(formData?.metrics)
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

function getSavedMetricOptionLookup(
  metricOptions: MetricOption[],
  savedMetrics: SavedMetric[],
): Map<string, MetricOption> {
  const optionByValue = new Map(
    metricOptions.map(option => [option.value, option] as const),
  );
  const optionLookup = new Map(optionByValue);

  savedMetrics.forEach(metric => {
    const option = getSavedMetricNames(metric)
      .map(alias => optionByValue.get(alias))
      .find(
        (metricOption): metricOption is MetricOption =>
          metricOption !== undefined,
      );

    if (!option) {
      return;
    }

    getSavedMetricNames(metric).forEach(alias => {
      optionLookup.set(alias, option);
    });
  });

  return optionLookup;
}

function getFieldConfig(formData?: CrosstabFormData): CrosstabFieldConfig {
  return formData?.crosstabFieldConfig ?? {};
}

function getSelectedMetricValue(
  selectedValue: string | undefined,
  metricOptions: MetricOption[],
  fallbackIndex: number,
  metricOptionLookup?: Map<string, MetricOption>,
): string | undefined {
  if (selectedValue !== undefined) {
    const option =
      metricOptionLookup?.get(selectedValue) ??
      metricOptions.find(metricOption => metricOption.value === selectedValue);

    if (option) {
      return option.value;
    }
  }

  return metricOptions[fallbackIndex]?.value;
}

function validateCalculatedFields(
  nextValue: CrosstabCalculatedField[],
  formData?: CrosstabFormData,
): void {
  getCalculatedFields({
    ...(formData ?? {
      datasource: '0__table',
      viz_type: 'crosstab-table',
    }),
    crosstabCalculatedFields: nextValue,
    crosstabParameters: formData?.crosstabParameters,
  } as CrosstabFormData);
}

function getParameterOptions(formData?: CrosstabFormData): ParameterOption[] {
  if (!formData) {
    return [];
  }

  try {
    return getCrosstabParameters(formData).map(parameter => ({
      label: parameter.label,
      value: parameter.id,
    }));
  } catch {
    return [];
  }
}

function getCalculatedFieldSemantic(
  field: CrosstabCalculatedField,
): MetricFieldConfig['semantic'] {
  return field.resultType === 'number' ? 'additive' : 'ratio';
}

function calculatedMetricConfig(
  field: CrosstabCalculatedField,
): MetricFieldConfig {
  return {
    metric: field.name,
    label: field.name,
    calculatedFieldId: field.id,
    semantic: getCalculatedFieldSemantic(field),
    formatString: field.formatString,
  };
}

function buildDefaultDraft(
  metricOptions: MetricOption[],
  parameterOptions: ParameterOption[],
): CalculatedFieldDraft {
  return {
    description: '',
    fieldId: 'profitRate',
    fieldName: t('Profit rate'),
    expression: createExpressionDraft({
      denominatorMetricId: metricOptions[1]?.value ?? metricOptions[0]?.value,
      numeratorMetricId: metricOptions[0]?.value,
      parameterId: parameterOptions[0]?.value,
    }),
    formatString: '.2%',
    resultType: 'percent',
  };
}

function resolveExpressionDraft(
  draft: ExpressionDraft,
  metricOptions: MetricOption[],
  metricOptionLookup: Map<string, MetricOption>,
): ExpressionDraft {
  switch (draft.kind) {
    case 'metric_ref':
      return {
        ...draft,
        metricId:
          getSelectedMetricValue(
            draft.metricId,
            metricOptions,
            0,
            metricOptionLookup,
          ) ?? draft.metricId,
      };
    case 'binary_op':
      return {
        ...draft,
        left: resolveExpressionDraft(
          draft.left,
          metricOptions,
          metricOptionLookup,
        ),
        right: resolveExpressionDraft(
          draft.right,
          metricOptions,
          metricOptionLookup,
        ),
      };
    case 'safe_div':
    case 'pct':
    case 'ratio':
      return {
        ...draft,
        numerator: resolveExpressionDraft(
          draft.numerator,
          metricOptions,
          metricOptionLookup,
        ),
        denominator: resolveExpressionDraft(
          draft.denominator,
          metricOptions,
          metricOptionLookup,
        ),
      };
    default:
      return draft;
  }
}

function draftFromCalculatedField(
  field: CrosstabCalculatedField,
  metricOptions: MetricOption[],
  metricOptionLookup: Map<string, MetricOption>,
  editingFieldId?: string,
): CalculatedFieldDraft {
  return {
    description: field.description ?? '',
    editingFieldId,
    fieldId: field.id,
    fieldName: field.name,
    expression: resolveExpressionDraft(
      astToDraft(field.ast),
      metricOptions,
      metricOptionLookup,
    ),
    formatString:
      field.formatString ??
      (field.resultType === 'percent'
        ? '.2%'
        : field.resultType === 'ratio'
          ? '.4f'
          : ''),
    resultType: field.resultType,
  };
}

function countMetricRefs(draft: ExpressionDraft): number {
  switch (draft.kind) {
    case 'metric_ref':
      return 1;
    case 'binary_op':
      return countMetricRefs(draft.left) + countMetricRefs(draft.right);
    case 'safe_div':
    case 'pct':
    case 'ratio':
      return (
        countMetricRefs(draft.numerator) + countMetricRefs(draft.denominator)
      );
    default:
      return 0;
  }
}

function getMetricConfigLabel(config: MetricFieldConfig): string {
  return config.label ?? getMetricLabel(config.metric);
}

function getNextCalculatedFields(
  value: CrosstabCalculatedField[],
  field: CrosstabCalculatedField,
  editingFieldId?: string,
): CrosstabCalculatedField[] {
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
  value: CrosstabCalculatedField[],
  field: CrosstabCalculatedField,
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
  field: CrosstabCalculatedField,
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

function clearLegacyCalculatedFieldInputs(
  setControlValue: (control: string, value: unknown) => void,
) {
  setControlValue('calculatedFields', []);
  setControlValue('metrics', []);
}

type ExpressionEditorProps = {
  draft: ExpressionDraft;
  metricOptionLookup: Map<string, MetricOption>;
  metricOptions: MetricOption[];
  onChange: (draft: ExpressionDraft) => void;
  parameterOptions: ParameterOption[];
  title: string;
};

function ExpressionEditor({
  draft,
  metricOptionLookup,
  metricOptions,
  onChange,
  parameterOptions,
  title,
}: ExpressionEditorProps) {
  const defaultNumeratorMetric = metricOptions[0]?.value;
  const defaultDenominatorMetric =
    metricOptions[1]?.value ?? metricOptions[0]?.value;
  const defaultParameter = parameterOptions[0]?.value;

  const replaceKind = (kind: ExpressionDraft['kind']) => {
    onChange(
      createExpressionDraft({
        denominatorMetricId: defaultDenominatorMetric,
        kind,
        numeratorMetricId: defaultNumeratorMetric,
        parameterId: defaultParameter,
      }),
    );
  };

  const kindSelector = (
    <Field>
      {t('%s kind', title)}
      <Select
        ariaLabel={t('%s kind', title)}
        allowSelectAll={false}
        options={[
          { label: t('Metric reference'), value: 'metric_ref' },
          { label: t('Parameter reference'), value: 'number_param' },
          { label: t('Literal number'), value: 'literal_number' },
          { label: t('Binary operation'), value: 'binary_op' },
          { label: t('Safe divide'), value: 'safe_div' },
          { label: t('Percent'), value: 'pct' },
          { label: t('Ratio'), value: 'ratio' },
        ]}
        value={draft.kind}
        onChange={nextKind => replaceKind(nextKind as ExpressionDraft['kind'])}
      />
    </Field>
  );

  switch (draft.kind) {
    case 'metric_ref':
      return (
        <>
          {kindSelector}
          <Field>
            {title}
            <Select
              ariaLabel={title}
              allowSelectAll={false}
              options={metricOptions}
              value={
                getSelectedMetricValue(
                  draft.metricId,
                  metricOptions,
                  0,
                  metricOptionLookup,
                ) ?? draft.metricId
              }
              onChange={nextMetric =>
                onChange({
                  ...draft,
                  metricId: String(nextMetric),
                })
              }
            />
          </Field>
        </>
      );
    case 'number_param':
      return (
        <>
          {kindSelector}
          <Field>
            {title}
            <Select
              ariaLabel={title}
              allowSelectAll={false}
              options={parameterOptions}
              value={draft.parameterId}
              onChange={nextParameter =>
                onChange({
                  ...draft,
                  parameterId: String(nextParameter),
                })
              }
            />
          </Field>
        </>
      );
    case 'literal_number':
      return (
        <>
          {kindSelector}
          <Field>
            {title}
            <Input
              aria-label={title}
              type="number"
              value={draft.value}
              onChange={event =>
                onChange({
                  ...draft,
                  value: event.target.value,
                })
              }
            />
          </Field>
        </>
      );
    case 'binary_op':
      return (
        <>
          {kindSelector}
          <Field>
            {t('Operator')}
            <Select
              ariaLabel={t('Operator')}
              allowSelectAll={false}
              options={[
                { label: '+', value: '+' },
                { label: '-', value: '-' },
                { label: '*', value: '*' },
                { label: '/', value: '/' },
              ]}
              value={draft.op}
              onChange={nextOperator =>
                onChange({
                  ...draft,
                  op: nextOperator as '+' | '-' | '*' | '/',
                })
              }
            />
          </Field>
          <ExpressionEditor
            draft={draft.left}
            metricOptionLookup={metricOptionLookup}
            metricOptions={metricOptions}
            onChange={left => onChange({ ...draft, left })}
            parameterOptions={parameterOptions}
            title={t('Left expression')}
          />
          <ExpressionEditor
            draft={draft.right}
            metricOptionLookup={metricOptionLookup}
            metricOptions={metricOptions}
            onChange={right => onChange({ ...draft, right })}
            parameterOptions={parameterOptions}
            title={t('Right expression')}
          />
        </>
      );
    case 'safe_div':
      return (
        <>
          {kindSelector}
          <ExpressionEditor
            draft={draft.numerator}
            metricOptionLookup={metricOptionLookup}
            metricOptions={metricOptions}
            onChange={numerator => onChange({ ...draft, numerator })}
            parameterOptions={parameterOptions}
            title={t('Numerator expression')}
          />
          <ExpressionEditor
            draft={draft.denominator}
            metricOptionLookup={metricOptionLookup}
            metricOptions={metricOptions}
            onChange={denominator => onChange({ ...draft, denominator })}
            parameterOptions={parameterOptions}
            title={t('Denominator expression')}
          />
          <Field>
            {t('Default value')}
            <Input
              aria-label={t('Default value')}
              type="number"
              value={draft.defaultValue ?? ''}
              onChange={event =>
                onChange({
                  ...draft,
                  defaultValue: event.target.value,
                })
              }
            />
          </Field>
        </>
      );
    case 'pct':
    case 'ratio':
      return (
        <>
          {kindSelector}
          <ExpressionEditor
            draft={draft.numerator}
            metricOptionLookup={metricOptionLookup}
            metricOptions={metricOptions}
            onChange={numerator => onChange({ ...draft, numerator })}
            parameterOptions={parameterOptions}
            title={t('Numerator metric')}
          />
          <ExpressionEditor
            draft={draft.denominator}
            metricOptionLookup={metricOptionLookup}
            metricOptions={metricOptions}
            onChange={denominator => onChange({ ...draft, denominator })}
            parameterOptions={parameterOptions}
            title={t('Denominator metric')}
          />
        </>
      );
    default:
      return null;
  }
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
  const parameterOptions = useMemo(
    () => getParameterOptions(formData),
    [formData],
  );
  const savedMetricOptionLookup = useMemo(
    () => getSavedMetricOptionLookup(metricOptions, savedMetrics),
    [metricOptions, savedMetrics],
  );
  const [draft, setDraft] = useState<CalculatedFieldDraft>(() =>
    buildDefaultDraft([], []),
  );
  const previewLabels = useMemo<ExpressionPreviewLabels>(
    () => ({
      metrics: Object.fromEntries(
        metricOptions.map(option => [option.value, option.label]),
      ),
      parameters: Object.fromEntries(
        parameterOptions.map(option => [option.value, option.label]),
      ),
    }),
    [metricOptions, parameterOptions],
  );
  const validationMessage = useMemo(
    () => validateExpressionDraft(draft.expression),
    [draft.expression],
  );
  const expressionPreview = useMemo(
    () => previewExpression(draft.expression, previewLabels),
    [draft.expression, previewLabels],
  );

  const resetDraft = useCallback(() => {
    setDraft(buildDefaultDraft(metricOptions, parameterOptions));
  }, [metricOptions, parameterOptions]);

  const openEditorForField = useCallback(
    (field: CrosstabCalculatedField, editingFieldId?: string) => {
      setDraft(
        draftFromCalculatedField(
          field,
          metricOptions,
          savedMetricOptionLookup,
          editingFieldId,
        ),
      );
      setIsOpen(true);
    },
    [metricOptions, savedMetricOptionLookup],
  );

  const saveField = useCallback(() => {
    const setControlValue = onControlChange ?? actions?.setControlValue;

    if (!setControlValue) {
      throw new Error(
        t('Calculated fields require crosstab field config updates.'),
      );
    }

    if (
      draft.fieldId.trim().length === 0 ||
      draft.fieldName.trim().length === 0
    ) {
      throw new Error(t('Calculated fields require ids and names.'));
    }

    if (countMetricRefs(draft.expression) > 0 && metricOptions.length < 2) {
      throw new Error(t('Calculated fields require two saved metrics.'));
    }

    const field: CrosstabCalculatedField = {
      id: draft.fieldId.trim(),
      name: draft.fieldName.trim(),
      description: draft.description.trim() || undefined,
      resultType: draft.resultType,
      formatString: draft.formatString.trim() || undefined,
      ast: draftToAst(draft.expression),
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
    validateCalculatedFields(nextValue, formData);
    onChange(nextValue);
    setControlValue('crosstabFieldConfig', nextFieldConfig);
    clearLegacyCalculatedFieldInputs(setControlValue);
    setIsOpen(false);
    resetDraft();
  }, [
    actions,
    draft,
    formData,
    metricOptions.length,
    onChange,
    onControlChange,
    resetDraft,
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

      validateCalculatedFields(nextValue, formData);
      onChange(nextValue);
      setControlValue('crosstabFieldConfig', nextFieldConfig);
      clearLegacyCalculatedFieldInputs(setControlValue);
      setDraft(currentDraft =>
        currentDraft.editingFieldId === fieldId
          ? buildDefaultDraft(metricOptions, parameterOptions)
          : currentDraft,
      );
      setIsOpen(false);
    },
    [
      actions,
      formData,
      metricOptions,
      onChange,
      onControlChange,
      parameterOptions,
      value,
    ],
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
          resetDraft();
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
            onClick={() => openEditorForField(field, field.id)}
          >
            {t('Edit')}
          </Button>
          <Button
            buttonSize="small"
            onClick={() => openEditorForField(duplicateCalculatedField(field))}
          >
            {t('Duplicate')}
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
            {t('Description')}
            <Input
              aria-label={t('Calculated field description')}
              value={draft.description}
              onChange={event =>
                setDraft(currentDraft => ({
                  ...currentDraft,
                  description: event.target.value,
                }))
              }
            />
          </Field>
          <Field>
            {t('Result type')}
            <Select
              ariaLabel={t('Result type')}
              allowSelectAll={false}
              options={[
                { label: t('Number'), value: 'number' },
                { label: t('Ratio'), value: 'ratio' },
                { label: t('Percent'), value: 'percent' },
              ]}
              value={draft.resultType}
              onChange={nextType =>
                setDraft(currentDraft => ({
                  ...currentDraft,
                  resultType: nextType as CrosstabCalculatedField['resultType'],
                }))
              }
            />
          </Field>
          <Field>
            {t('Format string')}
            <Input
              aria-label={t('Format string')}
              value={draft.formatString}
              onChange={event =>
                setDraft(currentDraft => ({
                  ...currentDraft,
                  formatString: event.target.value,
                }))
              }
            />
          </Field>
          <ExpressionEditor
            draft={draft.expression}
            metricOptionLookup={savedMetricOptionLookup}
            metricOptions={metricOptions}
            onChange={expression =>
              setDraft(currentDraft => ({
                ...currentDraft,
                expression,
              }))
            }
            parameterOptions={parameterOptions}
            title={t('Expression')}
          />
          <div>
            <strong>{t('Expression preview')}</strong>
            <code>{expressionPreview}</code>
          </div>
          <div>
            <strong>{t('Validation')}</strong>
            <span>{validationMessage}</span>
          </div>
          <Button buttonSize="small" buttonStyle="primary" onClick={saveField}>
            {t('Save calculated field')}
          </Button>
        </DrawerBody>
      </Drawer>
    </Editor>
  );
}
