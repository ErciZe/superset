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
import { getMetricLabel, isQueryFormMetric } from '@superset-ui/core';
import type {
  CrosstabDynamicMetricConfig,
  CrosstabDynamicMetricOption,
  CrosstabDynamicMetricSlot,
  CrosstabFormData,
  CrosstabOwnState,
  MetricFieldConfig,
  MetricSemantic,
} from '../types';
import {
  applyDynamicSlotSplices,
  ERR_DYNAMIC_SLOT_DUPLICATE_OPTION,
  ERR_DYNAMIC_SLOT_DUPLICATE_SLOT,
  ERR_DYNAMIC_SLOT_INVALID_OPTION,
  ERR_DYNAMIC_SLOT_OVERLAP,
  ERR_DYNAMIC_SLOT_SPLICE_COUNT,
  getDynamicSlotSpliceCount,
  resolveDynamicSlotOptions,
  validateDynamicSlots,
  type DynamicSlot,
  type SelectedDynamicSlotOption,
} from './dynamicSlots';

export const ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG =
  'ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG';
export const ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE =
  'ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE';
export const ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS =
  'ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS';
export const ERR_CROSSTAB_DYNAMIC_METRIC_OPTIONS =
  'ERR_CROSSTAB_DYNAMIC_METRIC_OPTIONS';
export const ERR_CROSSTAB_DYNAMIC_METRIC_SLOT =
  'ERR_CROSSTAB_DYNAMIC_METRIC_SLOT';
export const ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT =
  'ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT';
export const ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION =
  'ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION';
export const MAX_METRICS = 8;

type DynamicMetricSlotPayload = readonly MetricFieldConfig[];

type DynamicMetricDynamicSlot = DynamicSlot<DynamicMetricSlotPayload>;

type SelectedDynamicMetricSlotOption = SelectedDynamicSlotOption<
  DynamicMetricSlotPayload,
  DynamicMetricDynamicSlot
>;

type ResolveDynamicMetricConfigsArgs = {
  formData: CrosstabFormData;
  metricConfigs: MetricFieldConfig[];
  ownState?: CrosstabOwnState;
};

type ResolveDynamicMetricConfigsResult = {
  metricConfigs: MetricFieldConfig[];
  config?: CrosstabDynamicMetricConfig;
  selectedDynamicMetric?: Record<string, string>;
  signature: string;
};

const metricSemantics: ReadonlySet<unknown> = new Set([
  'unknown',
  'additive',
  'ratio',
  'average',
  'distinct',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isMetricSemantic(value: unknown): value is MetricSemantic {
  return metricSemantics.has(value);
}

function assertMetricConfig(
  value: unknown,
): asserts value is MetricFieldConfig {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  const { label, metric, semantic } = value;

  if (
    !isQueryFormMetric(metric) ||
    (label !== undefined && typeof label !== 'string') ||
    (semantic !== undefined && !isMetricSemantic(semantic))
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }
}

function assertMetricConfigArray(
  value: unknown,
): asserts value is MetricFieldConfig[] {
  if (!Array.isArray(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  value.forEach(assertMetricConfig);
}

function parseSlotIndex(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_SLOT);
  }

  if (value >= MAX_METRICS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS);
  }

  return value;
}

function parseSpliceCount(value: unknown): number {
  if (value === undefined) {
    return 1;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT);
  }

  if (value > MAX_METRICS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS);
  }

  return value;
}

function validateOption(value: unknown): CrosstabDynamicMetricOption {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  const { id, label, metrics } = value;

  if (!isNonEmptyString(id) || typeof label !== 'string') {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  assertMetricConfigArray(metrics);

  return { id, label, metrics };
}

function validateSlot(value: unknown): CrosstabDynamicMetricSlot {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  const { defaultOptionId, id, label, options, slotIndex } = value;
  const parsedSlotIndex = parseSlotIndex(slotIndex);
  const spliceCount = parseSpliceCount(value.spliceCount);

  if (
    !isNonEmptyString(id) ||
    (label !== undefined && typeof label !== 'string') ||
    !isNonEmptyString(defaultOptionId) ||
    !Array.isArray(options)
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  if (options.length === 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_OPTIONS);
  }

  if (parsedSlotIndex + spliceCount > MAX_METRICS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS);
  }

  const normalizedOptions = options.map(validateOption);

  if (!normalizedOptions.some(option => option.id === defaultOptionId)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION);
  }

  return {
    id,
    ...(label === undefined ? {} : { label }),
    slotIndex: parsedSlotIndex,
    spliceCount,
    defaultOptionId,
    options: normalizedOptions,
  };
}

function getDynamicMetricSlotError(error: Error): Error {
  switch (error.message) {
    case ERR_DYNAMIC_SLOT_DUPLICATE_OPTION:
      return new Error(ERR_CROSSTAB_DYNAMIC_METRIC_OPTIONS);
    case ERR_DYNAMIC_SLOT_DUPLICATE_SLOT:
    case ERR_DYNAMIC_SLOT_OVERLAP:
      return new Error(ERR_CROSSTAB_DYNAMIC_METRIC_SLOT);
    case ERR_DYNAMIC_SLOT_INVALID_OPTION:
      return new Error(ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION);
    case ERR_DYNAMIC_SLOT_SPLICE_COUNT:
      return new Error(ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT);
    default:
      return error;
  }
}

function getDynamicMetricDynamicSlot(
  slot: CrosstabDynamicMetricSlot,
): DynamicMetricDynamicSlot {
  return {
    id: slot.id,
    slotIndex: slot.slotIndex,
    spliceCount: slot.spliceCount,
    defaultOptionId: slot.defaultOptionId,
    options: slot.options.map(option => ({
      id: option.id,
      payload: option.metrics,
    })),
  };
}

function validateDynamicMetricSlots(slots: CrosstabDynamicMetricSlot[]): void {
  try {
    validateDynamicSlots(slots.map(getDynamicMetricDynamicSlot), {
      allowEmptyPayload: true,
      getPlacement: () => 'metrics',
    });
  } catch (error) {
    if (error instanceof Error) {
      throw getDynamicMetricSlotError(error);
    }

    throw error;
  }
}

function normalizeDynamicMetricConfig(
  value: unknown,
): CrosstabDynamicMetricConfig {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  if (!('slots' in value) && value.enabled === false) {
    return {
      enabled: false,
      slots: [],
    };
  }

  if (typeof value.enabled !== 'boolean' || !Array.isArray(value.slots)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  if (value.enabled && value.slots.length === 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  }

  const slots = value.slots.map(validateSlot);

  validateDynamicMetricSlots(slots);

  return {
    enabled: value.enabled,
    slots,
  };
}

export function getDynamicMetricConfig(
  formData: CrosstabFormData,
): CrosstabDynamicMetricConfig | undefined {
  const rawConfig = formData.dynamicMetric;

  if (rawConfig === undefined) {
    return undefined;
  }

  if (typeof rawConfig === 'string') {
    if (rawConfig.trim().length === 0) {
      return undefined;
    }

    try {
      return normalizeDynamicMetricConfig(JSON.parse(rawConfig));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
      }

      throw error;
    }
  }

  return normalizeDynamicMetricConfig(rawConfig);
}

function getMetricConfigIdentity(config: MetricFieldConfig): string {
  if (config.label) {
    return config.label;
  }

  if (config.metric === null || config.metric === undefined) {
    throw new Error('Unsupported crosstab metric field.');
  }

  const label = getMetricLabel(config.metric);
  if (!label) {
    throw new Error('Unsupported crosstab metric field.');
  }

  return label;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (!isObject(value)) {
    return JSON.stringify(value);
  }

  const sortedEntries = Object.keys(value)
    .sort()
    .map(key => [key, stableStringify(value[key])]);

  return `{${sortedEntries
    .map(
      ([key, serializedValue]) => `${JSON.stringify(key)}:${serializedValue}`,
    )
    .join(',')}}`;
}

function getMetricConfigSignaturePart(config: MetricFieldConfig): string {
  return [
    getMetricConfigIdentity(config),
    stableStringify(config.metric),
    config.semantic ?? '',
  ].join('\u001e');
}

export function getMetricConfigSignature(
  metricConfigs: MetricFieldConfig[],
): string {
  return metricConfigs.map(getMetricConfigSignaturePart).join('\u001f');
}

function validateSlotBounds(
  slots: CrosstabDynamicMetricSlot[],
  metricConfigs: MetricFieldConfig[],
): void {
  slots.forEach(slot => {
    const { slotIndex } = slot;
    const spliceCount = getDynamicSlotSpliceCount(slot);

    if (
      slotIndex > metricConfigs.length ||
      (slotIndex < metricConfigs.length &&
        slotIndex + spliceCount > metricConfigs.length)
    ) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_SLOT);
    }
  });
}

function resolveSelectedDynamicMetricOptions(
  slots: CrosstabDynamicMetricSlot[],
  ownState: CrosstabOwnState | undefined,
): SelectedDynamicMetricSlotOption[] {
  const selectedOptionIdsBySlot = slots.reduce<Record<string, string>>(
    (selectedOptionIds, slot) => ({
      ...selectedOptionIds,
      [slot.id]:
        ownState?.selectedDynamicMetric?.[slot.id] ?? slot.defaultOptionId,
    }),
    {},
  );

  try {
    return resolveDynamicSlotOptions(
      slots.map(getDynamicMetricDynamicSlot),
      selectedOptionIdsBySlot,
    );
  } catch (error) {
    if (error instanceof Error) {
      throw getDynamicMetricSlotError(error);
    }

    throw error;
  }
}

function assertNoDuplicateMetricLabels(
  metricConfigs: MetricFieldConfig[],
): void {
  const seenLabels = new Set<string>();

  metricConfigs.forEach(metricConfig => {
    const metricLabel = getMetricConfigIdentity(metricConfig);

    if (seenLabels.has(metricLabel)) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE);
    }

    seenLabels.add(metricLabel);
  });
}

function applySlotsToMetrics(
  metricConfigs: MetricFieldConfig[],
  slots: CrosstabDynamicMetricSlot[],
  selectedOptions: SelectedDynamicMetricSlotOption[],
): ResolveDynamicMetricConfigsResult {
  validateSlotBounds(slots, metricConfigs);

  const selectedDynamicMetric: Record<string, string> = {};

  selectedOptions.forEach(({ option, slot }) => {
    selectedDynamicMetric[slot.id] = option.id;
  });

  const effectiveMetricConfigs = applyDynamicSlotSplices(
    metricConfigs,
    selectedOptions,
  );

  assertNoDuplicateMetricLabels(effectiveMetricConfigs);

  if (effectiveMetricConfigs.length > MAX_METRICS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS);
  }

  return {
    metricConfigs: effectiveMetricConfigs,
    selectedDynamicMetric,
    signature: getMetricConfigSignature(effectiveMetricConfigs),
  };
}

export function resolveDynamicMetricConfigs({
  formData,
  metricConfigs,
  ownState,
}: ResolveDynamicMetricConfigsArgs): ResolveDynamicMetricConfigsResult {
  const config = getDynamicMetricConfig(formData);

  if (!config?.enabled) {
    return {
      metricConfigs,
      config: undefined,
      selectedDynamicMetric: undefined,
      signature: getMetricConfigSignature(metricConfigs),
    };
  }

  const selectedOptions = resolveSelectedDynamicMetricOptions(
    config.slots,
    ownState,
  );
  const result = applySlotsToMetrics(
    metricConfigs,
    config.slots,
    selectedOptions,
  );

  return {
    ...result,
    config,
  };
}
