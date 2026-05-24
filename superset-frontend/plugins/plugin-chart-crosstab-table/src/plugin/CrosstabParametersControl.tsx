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
import { useCallback, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import { Button, Input } from '@superset-ui/core/components';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import type { CrosstabFormData, CrosstabParameter } from '../types';
import { getCrosstabParameters } from './parameters';

const Editor = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

type CrosstabParametersControlProps = {
  actions?: {
    setControlValue?: (control: string, value: unknown) => void;
  };
  hovered?: boolean;
  label?: string;
  name: string;
  onChange: (value: CrosstabParameter[]) => void;
  onControlChange?: (control: string, value: unknown) => void;
  value?: CrosstabParameter[];
};

type NumberParameterDraft = {
  id: string;
  kind: 'number';
  name: string;
  label: string;
  defaultValue: string;
  min: string;
  max: string;
  step: string;
  unit: string;
};

function numberDraft(): NumberParameterDraft {
  return {
    id: 'param_adjustment',
    kind: 'number',
    name: 'adjustmentRate',
    label: t('Adjustment rate'),
    defaultValue: '1',
    min: '',
    max: '',
    step: '',
    unit: '',
  };
}

function draftFromParameter(
  parameter: CrosstabParameter,
): NumberParameterDraft {
  return {
    ...parameter,
    defaultValue: String(parameter.defaultValue),
    min: parameter.min === undefined ? '' : String(parameter.min),
    max: parameter.max === undefined ? '' : String(parameter.max),
    step: parameter.step === undefined ? '' : String(parameter.step),
    unit: parameter.unit ?? '',
  };
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      t('Crosstab parameter numeric fields require finite numbers.'),
    );
  }

  return parsed;
}

function parameterFromDraft(draft: NumberParameterDraft): CrosstabParameter {
  if (draft.defaultValue.trim().length === 0) {
    throw new Error(
      t('Crosstab parameter numeric fields require finite numbers.'),
    );
  }

  const defaultValue = Number(draft.defaultValue);

  if (!Number.isFinite(defaultValue)) {
    throw new Error(
      t('Crosstab parameter numeric fields require finite numbers.'),
    );
  }

  const min = parseOptionalNumber(draft.min);
  const max = parseOptionalNumber(draft.max);
  const step = parseOptionalNumber(draft.step);
  const unit = draft.unit.trim() || undefined;

  return {
    id: draft.id.trim(),
    kind: 'number',
    name: draft.name.trim(),
    label: draft.label.trim(),
    defaultValue,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(unit === undefined ? {} : { unit }),
  };
}

function validateParameters(nextValue: CrosstabParameter[]): void {
  getCrosstabParameters({
    viz_type: 'crosstab-table',
    datasource: '0__table',
    crosstabParameters: nextValue,
  } as CrosstabFormData);
}

function clearLegacyParameters(
  actions: CrosstabParametersControlProps['actions'],
  onControlChange: CrosstabParametersControlProps['onControlChange'],
) {
  const setControlValue = onControlChange ?? actions?.setControlValue;
  setControlValue?.('parameters', undefined);
}

export default function CrosstabParametersControl({
  actions,
  hovered,
  label,
  name,
  onChange,
  onControlChange,
  value = [],
}: CrosstabParametersControlProps) {
  const [draft, setDraft] = useState<NumberParameterDraft | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();

  const saveDraft = useCallback(() => {
    if (!draft) {
      return;
    }

    const parameter = parameterFromDraft(draft);
    const nextValue =
      editingId === undefined
        ? [...value, parameter]
        : value.map(existingParameter =>
            existingParameter.id === editingId ? parameter : existingParameter,
          );

    validateParameters(nextValue);
    onChange(nextValue);
    clearLegacyParameters(actions, onControlChange);
    setDraft(undefined);
    setEditingId(undefined);
  }, [actions, draft, editingId, onChange, onControlChange, value]);

  const deleteParameter = useCallback(
    (indexToDelete: number) => {
      const nextValue = value.filter((_, index) => index !== indexToDelete);

      validateParameters(nextValue);
      onChange(nextValue);
      clearLegacyParameters(actions, onControlChange);
      setDraft(currentDraft =>
        currentDraft?.id === value[indexToDelete]?.id
          ? undefined
          : currentDraft,
      );
      setEditingId(currentEditingId =>
        currentEditingId === value[indexToDelete]?.id
          ? undefined
          : currentEditingId,
      );
    },
    [actions, onChange, onControlChange, value],
  );

  const updateDraft = useCallback(
    (
      field:
        | 'id'
        | 'name'
        | 'label'
        | 'defaultValue'
        | 'min'
        | 'max'
        | 'step'
        | 'unit',
      nextValue: string,
    ) => {
      setDraft(currentDraft =>
        currentDraft ? { ...currentDraft, [field]: nextValue } : currentDraft,
      );
    },
    [],
  );

  return (
    <Editor data-test="crosstab-parameters-control">
      <ControlHeader
        hovered={hovered}
        label={label}
        name={name}
        renderTrigger
      />
      <ActionRow>
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={() => {
            setDraft(numberDraft());
            setEditingId(undefined);
          }}
        >
          {t('Add number parameter')}
        </Button>
      </ActionRow>
      {value.map((parameter, index) => (
        <ActionRow key={parameter.id}>
          <span>{parameter.label}</span>
          <Button
            buttonSize="small"
            onClick={() => {
              setDraft(draftFromParameter(parameter));
              setEditingId(parameter.id);
            }}
          >
            {t('Edit')}
          </Button>
          <Button buttonSize="small" onClick={() => deleteParameter(index)}>
            {t('Delete')}
          </Button>
        </ActionRow>
      ))}
      {draft && (
        <FieldGrid>
          <Field>
            {t('Id')}
            <Input
              aria-label={t('Parameter id')}
              value={draft.id}
              onChange={event => updateDraft('id', event.target.value)}
            />
          </Field>
          <Field>
            {t('Name')}
            <Input
              aria-label={t('Parameter name')}
              value={draft.name}
              onChange={event => updateDraft('name', event.target.value)}
            />
          </Field>
          <Field>
            {t('Label')}
            <Input
              aria-label={t('Parameter label')}
              value={draft.label}
              onChange={event => updateDraft('label', event.target.value)}
            />
          </Field>
          <Field>
            {t('Default')}
            <Input
              aria-label={t('Parameter default')}
              type="number"
              value={draft.defaultValue}
              onChange={event =>
                updateDraft('defaultValue', event.target.value)
              }
            />
          </Field>
          <Field>
            {t('Min')}
            <Input
              aria-label={t('Parameter min')}
              type="number"
              value={draft.min}
              onChange={event => updateDraft('min', event.target.value)}
            />
          </Field>
          <Field>
            {t('Max')}
            <Input
              aria-label={t('Parameter max')}
              type="number"
              value={draft.max}
              onChange={event => updateDraft('max', event.target.value)}
            />
          </Field>
          <Field>
            {t('Step')}
            <Input
              aria-label={t('Parameter step')}
              type="number"
              value={draft.step}
              onChange={event => updateDraft('step', event.target.value)}
            />
          </Field>
          <Field>
            {t('Unit')}
            <Input
              aria-label={t('Parameter unit')}
              value={draft.unit}
              onChange={event => updateDraft('unit', event.target.value)}
            />
          </Field>
          <ActionRow>
            <Button buttonSize="small" onClick={saveDraft}>
              {editingId === undefined ? t('Save') : t('Update')}
            </Button>
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              onClick={() => {
                setDraft(undefined);
                setEditingId(undefined);
              }}
            >
              {t('Cancel')}
            </Button>
          </ActionRow>
        </FieldGrid>
      )}
    </Editor>
  );
}
