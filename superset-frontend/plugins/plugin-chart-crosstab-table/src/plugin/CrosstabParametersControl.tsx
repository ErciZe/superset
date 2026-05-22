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
  hovered?: boolean;
  label?: string;
  name: string;
  onChange: (value: CrosstabParameter[]) => void;
  value?: CrosstabParameter[];
};

type NumberParameterDraft = {
  id: string;
  kind: 'number';
  name: string;
  label: string;
  defaultValue: string;
};

type TextParameterDraft = {
  id: string;
  kind: 'text';
  name: string;
  label: string;
  defaultValue: string;
};

type ParameterDraft = NumberParameterDraft | TextParameterDraft;

function numberDraft(): NumberParameterDraft {
  return {
    id: 'adjustmentRate',
    kind: 'number',
    name: 'adjustmentRate',
    label: t('Adjustment rate'),
    defaultValue: '1',
  };
}

function textDraft(): TextParameterDraft {
  return {
    id: 'market',
    kind: 'text',
    name: 'market',
    label: t('Market'),
    defaultValue: '',
  };
}

function draftFromParameter(parameter: CrosstabParameter): ParameterDraft {
  return {
    ...parameter,
    defaultValue: String(parameter.defaultValue),
  };
}

function parameterFromDraft(draft: ParameterDraft): CrosstabParameter {
  if (draft.kind === 'number') {
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

    return {
      id: draft.id.trim(),
      kind: 'number',
      name: draft.name.trim(),
      label: draft.label.trim(),
      defaultValue,
    };
  }

  return {
    id: draft.id.trim(),
    kind: 'text',
    name: draft.name.trim(),
    label: draft.label.trim(),
    defaultValue: draft.defaultValue,
  };
}

function validateParameters(nextValue: CrosstabParameter[]): void {
  getCrosstabParameters({
    viz_type: 'crosstab-table',
    datasource: '0__table',
    crosstabParameters: nextValue,
  } as CrosstabFormData);
}

export default function CrosstabParametersControl({
  hovered,
  label,
  name,
  onChange,
  value = [],
}: CrosstabParametersControlProps) {
  const [draft, setDraft] = useState<ParameterDraft | undefined>();
  const [editingIndex, setEditingIndex] = useState<number | undefined>();

  const saveDraft = useCallback(() => {
    if (!draft) {
      return;
    }

    const parameter = parameterFromDraft(draft);
    const nextValue =
      editingIndex === undefined
        ? [...value, parameter]
        : value.map((existingParameter, index) =>
            index === editingIndex ? parameter : existingParameter,
          );

    validateParameters(nextValue);
    onChange(nextValue);
    setDraft(undefined);
    setEditingIndex(undefined);
  }, [draft, editingIndex, onChange, value]);

  const deleteParameter = useCallback(
    (indexToDelete: number) => {
      const nextValue = value.filter((_, index) => index !== indexToDelete);

      validateParameters(nextValue);
      onChange(nextValue);
    },
    [onChange, value],
  );

  const updateDraft = useCallback(
    (field: 'id' | 'name' | 'label' | 'defaultValue', nextValue: string) => {
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
            setEditingIndex(undefined);
          }}
        >
          {t('Add number parameter')}
        </Button>
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={() => {
            setDraft(textDraft());
            setEditingIndex(undefined);
          }}
        >
          {t('Add text parameter')}
        </Button>
      </ActionRow>
      {value.map((parameter, index) => (
        <ActionRow key={parameter.id}>
          <span>{parameter.label}</span>
          <Button
            buttonSize="small"
            onClick={() => {
              setDraft(draftFromParameter(parameter));
              setEditingIndex(index);
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
              type={draft.kind === 'number' ? 'number' : 'text'}
              value={draft.defaultValue}
              onChange={event =>
                updateDraft('defaultValue', event.target.value)
              }
            />
          </Field>
          <Button buttonSize="small" buttonStyle="primary" onClick={saveDraft}>
            {t('Save parameter')}
          </Button>
        </FieldGrid>
      )}
    </Editor>
  );
}
