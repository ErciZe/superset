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
import { useCallback, useMemo } from 'react';
import { styled, t } from '@superset-ui/core';
import { Input } from '@superset-ui/core/components';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import type { CrosstabNumberParameter } from '../types';

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

type NumericParameterField = 'default' | 'min' | 'max' | 'step';

type CrosstabParametersControlProps = {
  hovered?: boolean;
  label?: string;
  name: string;
  onChange: (value: CrosstabNumberParameter[]) => void;
  value?: CrosstabNumberParameter[];
};

const defaultParameter: CrosstabNumberParameter = {
  kind: 'number',
  name: 'adjustmentRate',
  label: '调整系数',
  default: 1,
  min: 0,
  max: 2,
  step: 0.01,
};

export default function CrosstabParametersControl({
  hovered,
  label,
  name,
  onChange,
  value,
}: CrosstabParametersControlProps) {
  const parameter = useMemo(
    () => ({ ...defaultParameter, ...(value?.[0] ?? {}) }),
    [value],
  );

  const updateParameter = useCallback(
    (nextParameter: CrosstabNumberParameter) => {
      onChange([nextParameter]);
    },
    [onChange],
  );

  const updateTextField = useCallback(
    (field: 'name' | 'label', nextValue: string) => {
      updateParameter({
        ...parameter,
        [field]: nextValue,
      });
    },
    [parameter, updateParameter],
  );

  const updateNumericField = useCallback(
    (field: NumericParameterField, nextValue: string) => {
      updateParameter({
        ...parameter,
        [field]: Number(nextValue),
      });
    },
    [parameter, updateParameter],
  );

  return (
    <Editor data-test="crosstab-parameters-control">
      <ControlHeader
        hovered={hovered}
        label={label}
        name={name}
        renderTrigger
      />
      <strong>{t('Number parameter')}</strong>
      <FieldGrid>
        <Field>
          {t('Name')}
          <Input
            aria-label={t('Parameter name')}
            value={parameter.name}
            onChange={event => updateTextField('name', event.target.value)}
          />
        </Field>
        <Field>
          {t('Label')}
          <Input
            aria-label={t('Parameter label')}
            value={parameter.label ?? ''}
            onChange={event => updateTextField('label', event.target.value)}
          />
        </Field>
        <Field>
          {t('Default')}
          <Input
            aria-label={t('Parameter default')}
            type="number"
            value={parameter.default}
            onChange={event =>
              updateNumericField('default', event.target.value)
            }
          />
        </Field>
        <Field>
          {t('Min')}
          <Input
            aria-label={t('Parameter min')}
            type="number"
            value={parameter.min}
            onChange={event => updateNumericField('min', event.target.value)}
          />
        </Field>
        <Field>
          {t('Max')}
          <Input
            aria-label={t('Parameter max')}
            type="number"
            value={parameter.max}
            onChange={event => updateNumericField('max', event.target.value)}
          />
        </Field>
        <Field>
          {t('Step')}
          <Input
            aria-label={t('Parameter step')}
            type="number"
            value={parameter.step}
            onChange={event => updateNumericField('step', event.target.value)}
          />
        </Field>
      </FieldGrid>
    </Editor>
  );
}
