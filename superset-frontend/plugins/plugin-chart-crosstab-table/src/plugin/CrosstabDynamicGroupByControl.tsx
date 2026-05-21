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
  styled,
  t,
  type QueryFormColumn,
} from '@superset-ui/core';
import type { ColumnMeta } from '@superset-ui/chart-controls';
import { Button, Checkbox, Input, Select } from '@superset-ui/core/components';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import type {
  CrosstabDynamicGroupByConfig,
  CrosstabDynamicGroupByOption,
  CrosstabDynamicGroupBySlot,
  DynamicGroupByPlacement,
} from '../types';
import {
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG,
  normalizeDynamicGroupByConfig,
} from './dynamicGroupBy';

const Editor = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const SlotCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const OptionCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ErrorText = styled.div`
  color: ${({ theme }) => theme.colorError};
`;

const EMPTY_ACTIONS = {} as never;

type CrosstabDynamicGroupByControlProps = {
  columns?: ColumnMeta[];
  hovered?: boolean;
  label?: string;
  name: string;
  onChange: (value: CrosstabDynamicGroupByConfig) => void;
  value?: CrosstabDynamicGroupByConfig;
};

type PartialDynamicGroupByOption = Partial<
  Omit<CrosstabDynamicGroupByOption, 'columns'>
> & {
  columns?: QueryFormColumn[];
};

type PartialDynamicGroupBySlot = Partial<
  Omit<CrosstabDynamicGroupBySlot, 'options'>
> & {
  options?: PartialDynamicGroupByOption[];
};

type PartialDynamicGroupByConfig = Partial<
  Omit<CrosstabDynamicGroupByConfig, 'slots'>
> & {
  slots?: PartialDynamicGroupBySlot[];
};

const defaultConfig: CrosstabDynamicGroupByConfig = {
  enabled: false,
  slots: [],
};

function isCanonicalDynamicGroupByConfig(
  value: unknown,
): value is CrosstabDynamicGroupByConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'enabled' in value &&
    'slots' in value
  );
}

export function validateDynamicGroupByConfig(
  value: unknown,
): CrosstabDynamicGroupByConfig {
  if (!isCanonicalDynamicGroupByConfig(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  return normalizeDynamicGroupByConfig(value);
}

function createOption(index: number): CrosstabDynamicGroupByOption {
  const id = `option_${index + 1}`;

  return {
    id,
    label: t('Option %s', index + 1),
    columns: [],
  };
}

function createSlot(index: number): CrosstabDynamicGroupBySlot {
  const option = createOption(0);

  return {
    id: `slot_${index + 1}`,
    label: t('Slot %s', index + 1),
    placement: 'rows',
    slotIndex: 0,
    spliceCount: 1,
    defaultOptionId: option.id,
    options: [option],
  };
}

function normalizeOptionForRender(
  option: PartialDynamicGroupByOption,
  index: number,
): CrosstabDynamicGroupByOption {
  const fallback = createOption(index);

  return {
    ...fallback,
    ...option,
    columns: ensureIsArray<QueryFormColumn>(option.columns),
  };
}

function normalizeSlotForRender(
  slot: PartialDynamicGroupBySlot,
  index: number,
): CrosstabDynamicGroupBySlot {
  const fallback = createSlot(index);
  const options = ensureIsArray(slot.options).map(normalizeOptionForRender);

  return {
    ...fallback,
    ...slot,
    options,
    defaultOptionId:
      slot.defaultOptionId ?? options[0]?.id ?? fallback.defaultOptionId,
  };
}

function getConfig(value?: PartialDynamicGroupByConfig) {
  return {
    ...defaultConfig,
    ...value,
    enabled: value?.enabled === true,
    slots: ensureIsArray(value?.slots).map(normalizeSlotForRender),
  };
}

function numberValue(value: string) {
  return Number.parseInt(value, 10);
}

function columnValues(option: CrosstabDynamicGroupByOption) {
  return option.columns;
}

export default function CrosstabDynamicGroupByControl({
  columns = [],
  hovered,
  label,
  name,
  onChange,
  value,
}: CrosstabDynamicGroupByControlProps) {
  const config = useMemo(() => getConfig(value), [value]);
  const [error, setError] = useState<string | undefined>();

  const emit = useCallback(
    (nextConfig: CrosstabDynamicGroupByConfig) => {
      try {
        onChange(validateDynamicGroupByConfig(nextConfig));
        setError(undefined);
      } catch (validationError) {
        if (validationError instanceof Error) {
          setError(validationError.message);
        }
      }
    },
    [onChange],
  );

  const updateSlot = useCallback(
    (
      slot: CrosstabDynamicGroupBySlot,
      nextSlot: CrosstabDynamicGroupBySlot,
    ) => {
      emit({
        ...config,
        slots: config.slots.map(candidate =>
          candidate.id === slot.id ? nextSlot : candidate,
        ),
      });
    },
    [config, emit],
  );

  const updateOption = useCallback(
    (
      slot: CrosstabDynamicGroupBySlot,
      option: CrosstabDynamicGroupByOption,
      nextOption: CrosstabDynamicGroupByOption,
    ) => {
      updateSlot(slot, {
        ...slot,
        defaultOptionId:
          slot.defaultOptionId === option.id
            ? nextOption.id
            : slot.defaultOptionId,
        options: slot.options.map(candidate =>
          candidate.id === option.id ? nextOption : candidate,
        ),
      });
    },
    [updateSlot],
  );

  return (
    <Editor data-test="crosstab-dynamic-group-by-control">
      <ControlHeader
        hovered={hovered}
        label={label}
        name={name}
        renderTrigger
      />
      <Checkbox
        checked={config.enabled}
        onChange={event =>
          emit({
            enabled: event.target.checked,
            slots:
              event.target.checked && config.slots.length === 0
                ? [createSlot(0)]
                : config.slots,
          })
        }
      >
        {t('Enable dynamic group by')}
      </Checkbox>
      {config.slots.map(slot => (
        <SlotCard key={slot.id}>
          <HeaderRow>
            <strong>{slot.label || slot.id}</strong>
            <Button
              buttonSize="xsmall"
              buttonStyle="tertiary"
              onClick={() =>
                emit({
                  ...config,
                  slots: config.slots.filter(candidate => candidate !== slot),
                })
              }
            >
              {t('Delete slot')}
            </Button>
          </HeaderRow>
          <FieldGrid>
            <Field>
              {t('Slot id')}
              <Input
                value={slot.id}
                onChange={event =>
                  updateSlot(slot, { ...slot, id: event.target.value })
                }
              />
            </Field>
            <Field>
              {t('Slot label')}
              <Input
                value={slot.label ?? ''}
                onChange={event =>
                  updateSlot(slot, {
                    ...slot,
                    label: event.target.value || undefined,
                  })
                }
              />
            </Field>
            <Field>
              {t('Placement')}
              <Select
                ariaLabel={t('Placement')}
                options={[
                  { label: t('Rows'), value: 'rows' },
                  { label: t('Columns'), value: 'columns' },
                ]}
                value={slot.placement}
                onChange={nextPlacement =>
                  updateSlot(slot, {
                    ...slot,
                    placement: nextPlacement as DynamicGroupByPlacement,
                  })
                }
              />
            </Field>
            <Field>
              {t('Slot index')}
              <Input
                type="number"
                value={slot.slotIndex}
                onChange={event =>
                  updateSlot(slot, {
                    ...slot,
                    slotIndex: numberValue(event.target.value),
                  })
                }
              />
            </Field>
            <Field>
              {t('Splice count')}
              <Input
                type="number"
                value={slot.spliceCount ?? 1}
                onChange={event =>
                  updateSlot(slot, {
                    ...slot,
                    spliceCount: numberValue(event.target.value),
                  })
                }
              />
            </Field>
            <Field>
              {t('Default option')}
              <Select
                ariaLabel={t('Default option')}
                options={slot.options.map(option => ({
                  label: option.label || option.id,
                  value: option.id,
                }))}
                value={slot.defaultOptionId}
                onChange={nextOptionId =>
                  updateSlot(slot, {
                    ...slot,
                    defaultOptionId: String(nextOptionId),
                  })
                }
              />
            </Field>
          </FieldGrid>
          {slot.options.map(option => (
            <OptionCard key={option.id}>
              <HeaderRow>
                <strong>{option.label || option.id}</strong>
                <Button
                  buttonSize="xsmall"
                  buttonStyle="tertiary"
                  onClick={() => {
                    const options = slot.options.filter(
                      candidate => candidate !== option,
                    );

                    updateSlot(slot, {
                      ...slot,
                      defaultOptionId:
                        slot.defaultOptionId === option.id
                          ? (options[0]?.id ?? slot.defaultOptionId)
                          : slot.defaultOptionId,
                      options,
                    });
                  }}
                >
                  {t('Delete option')}
                </Button>
              </HeaderRow>
              <FieldGrid>
                <Field>
                  {t('Option id')}
                  <Input
                    value={option.id}
                    onChange={event =>
                      updateOption(slot, option, {
                        ...option,
                        id: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field>
                  {t('Option label')}
                  <Input
                    value={option.label}
                    onChange={event =>
                      updateOption(slot, option, {
                        ...option,
                        label: event.target.value,
                      })
                    }
                  />
                </Field>
              </FieldGrid>
              <DndColumnSelect
                actions={EMPTY_ACTIONS}
                label={t('Columns')}
                multi
                name={`${name}-${slot.id}-${option.id}-columns`}
                onChange={nextColumns =>
                  updateOption(slot, option, {
                    ...option,
                    columns: ensureIsArray<QueryFormColumn>(nextColumns),
                  })
                }
                options={columns}
                type="DndColumnSelect"
                value={columnValues(option)}
              />
            </OptionCard>
          ))}
          <Button
            buttonSize="small"
            buttonStyle="secondary"
            onClick={() => {
              const option = createOption(slot.options.length);

              updateSlot(slot, {
                ...slot,
                options: [...slot.options, option],
              });
            }}
          >
            {t('Add option')}
          </Button>
        </SlotCard>
      ))}
      <Button
        buttonSize="small"
        buttonStyle="secondary"
        onClick={() =>
          emit({
            ...config,
            slots: [...config.slots, createSlot(config.slots.length)],
          })
        }
      >
        {t('Add slot')}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </Editor>
  );
}
