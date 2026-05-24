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
  type QueryFormMetric,
} from '@superset-ui/core';
import type { ColumnMeta, Metric } from '@superset-ui/chart-controls';
import { Button, Checkbox, Input, Select } from '@superset-ui/core/components';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl';
import type {
  CrosstabDynamicMetricConfig,
  CrosstabDynamicMetricOption,
  CrosstabDynamicMetricSlot,
  MetricFieldConfig,
  MetricSemantic,
  CrosstabFormData,
} from '../types';
import {
  ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG,
  MAX_METRICS,
  getDynamicMetricConfig,
} from './dynamicMetric';
import { validateDynamicSlots } from './dynamicSlots';
import { getMetricSemanticLabel } from './metricSemantics';

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

type CrosstabDynamicMetricControlProps = {
  columns?: ColumnMeta[];
  datasource?: unknown;
  hovered?: boolean;
  label?: string;
  name: string;
  onChange: (value: CrosstabDynamicMetricConfig) => void;
  savedMetrics?: Metric[];
  value?: CrosstabDynamicMetricConfig;
};

type PartialDynamicMetricOption = Partial<
  Omit<CrosstabDynamicMetricOption, 'metrics'>
> & {
  metrics?: MetricFieldConfig[];
};

type PartialDynamicMetricSlot = Partial<
  Omit<CrosstabDynamicMetricSlot, 'options'>
> & {
  options?: PartialDynamicMetricOption[];
};

type PartialDynamicMetricConfig = Partial<
  Omit<CrosstabDynamicMetricConfig, 'slots'>
> & {
  slots?: PartialDynamicMetricSlot[];
};

const metricSemantics: MetricSemantic[] = [
  'unknown',
  'additive',
  'ratio',
  'average',
  'distinct',
];

const defaultConfig: CrosstabDynamicMetricConfig = {
  enabled: false,
  slots: [],
};

function isCanonicalDynamicMetricConfig(
  value: unknown,
): value is CrosstabDynamicMetricConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'enabled' in value &&
    'slots' in value
  );
}

export function validateDynamicMetricControlConfig(
  value: unknown,
): CrosstabDynamicMetricConfig {
  if (!isCanonicalDynamicMetricConfig(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  validateDynamicSlots(
    value.slots.map(slot => ({
      id: slot.id,
      slotIndex: slot.slotIndex,
      spliceCount: slot.spliceCount,
      defaultOptionId: slot.defaultOptionId,
      options: slot.options.map(option => ({
        id: option.id,
        payload: option.metrics,
      })),
    })),
    {
      allowEmptyPayload: true,
      getPlacement: () => 'metrics',
    },
  );

  const normalizedConfig = getDynamicMetricConfig({
    dynamicMetric: value,
  } as CrosstabFormData);

  if (!normalizedConfig) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  normalizedConfig.slots.forEach(slot => {
    if (slot.slotIndex + (slot.spliceCount ?? 1) > MAX_METRICS) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
    }
  });

  return normalizedConfig;
}

function createOption(index: number): CrosstabDynamicMetricOption {
  const id = `option_${index + 1}`;

  return {
    id,
    label: t('Option %s', index + 1),
    metrics: [],
  };
}

function createSlot(index: number): CrosstabDynamicMetricSlot {
  const option = createOption(0);

  return {
    id: `slot_${index + 1}`,
    label: t('Slot %s', index + 1),
    slotIndex: 0,
    spliceCount: 1,
    defaultOptionId: option.id,
    options: [option],
  };
}

function normalizeOptionForRender(
  option: PartialDynamicMetricOption,
  index: number,
): CrosstabDynamicMetricOption {
  const fallback = createOption(index);

  return {
    ...fallback,
    ...option,
    metrics: ensureIsArray(option.metrics),
  };
}

function normalizeSlotForRender(
  slot: PartialDynamicMetricSlot,
  index: number,
): CrosstabDynamicMetricSlot {
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

function getConfig(value?: PartialDynamicMetricConfig) {
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

function metricValues(option: CrosstabDynamicMetricOption) {
  return option.metrics.map(item => item.metric);
}

function mergeMetricItems(
  nextMetrics: QueryFormMetric[],
  previousMetrics: MetricFieldConfig[],
) {
  return nextMetrics.map(metric => {
    const previous = previousMetrics.find(item => item.metric === metric);

    return previous ? { ...previous, metric } : { metric };
  });
}

export default function CrosstabDynamicMetricControl({
  columns = [],
  datasource,
  hovered,
  label,
  name,
  onChange,
  savedMetrics = [],
  value,
}: CrosstabDynamicMetricControlProps) {
  const config = useMemo(() => getConfig(value), [value]);
  const [error, setError] = useState<string | undefined>();

  const emit = useCallback(
    (nextConfig: CrosstabDynamicMetricConfig) => {
      try {
        onChange(validateDynamicMetricControlConfig(nextConfig));
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
    (slot: CrosstabDynamicMetricSlot, nextSlot: CrosstabDynamicMetricSlot) => {
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
      slot: CrosstabDynamicMetricSlot,
      option: CrosstabDynamicMetricOption,
      nextOption: CrosstabDynamicMetricOption,
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

  const updateMetricSemantic = useCallback(
    (
      slot: CrosstabDynamicMetricSlot,
      option: CrosstabDynamicMetricOption,
      metricConfig: MetricFieldConfig,
      semantic: MetricSemantic,
    ) => {
      updateOption(slot, option, {
        ...option,
        metrics: option.metrics.map(candidate =>
          candidate.metric === metricConfig.metric
            ? { ...candidate, semantic }
            : candidate,
        ),
      });
    },
    [updateOption],
  );

  return (
    <Editor data-test="crosstab-dynamic-metric-control">
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
        {t('Enable dynamic metrics')}
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
              <DndMetricSelect
                columns={columns}
                datasource={datasource}
                label={t('Metrics')}
                multi
                name={`${name}-${slot.id}-${option.id}-metrics`}
                onChange={(
                  nextMetrics:
                    | QueryFormMetric[]
                    | QueryFormMetric
                    | null
                    | undefined,
                ) =>
                  updateOption(slot, option, {
                    ...option,
                    metrics: mergeMetricItems(
                      ensureIsArray<QueryFormMetric>(nextMetrics),
                      option.metrics,
                    ),
                  })
                }
                savedMetrics={savedMetrics}
                value={metricValues(option)}
              />
              {option.metrics.map(metricConfig => (
                <Field key={String(metricConfig.metric)}>
                  {t('Metric semantic')}
                  <Select
                    ariaLabel={t('Metric semantic')}
                    options={metricSemantics.map(semantic => ({
                      label: getMetricSemanticLabel(semantic),
                      value: semantic,
                    }))}
                    value={metricConfig.semantic ?? 'unknown'}
                    onChange={semantic =>
                      updateMetricSemantic(
                        slot,
                        option,
                        metricConfig,
                        semantic as MetricSemantic,
                      )
                    }
                  />
                </Field>
              ))}
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
