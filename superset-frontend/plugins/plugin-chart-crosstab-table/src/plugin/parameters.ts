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
import type {
  CrosstabFormData,
  CrosstabOwnState,
  CrosstabParameter,
} from '../types';
import { assertNoLegacyV4Inputs } from './v4Contract';

export const ERR_CROSSTAB_PARAMETER_CONFIG = 'ERR_CROSSTAB_PARAMETER_CONFIG';
export const ERR_CROSSTAB_PARAMETER_VALUE = 'ERR_CROSSTAB_PARAMETER_VALUE';

export type CrosstabParameterValues = Record<string, number>;

export type ResolvedCrosstabParameters = {
  config: CrosstabParameter[];
  values: CrosstabParameterValues;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertFiniteNumber(
  value: unknown,
  error: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(error);
  }
}

function assertOptionalFiniteNumber(
  value: unknown,
): asserts value is number | undefined {
  if (value !== undefined) {
    assertFiniteNumber(value, ERR_CROSSTAB_PARAMETER_CONFIG);
  }
}

function assertOptionalString(
  value: unknown,
): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }
}

function assertNonEmptyString(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }
}

function parseParameterInput(
  value: CrosstabFormData['crosstabParameters'],
): unknown[] {
  if (value === undefined || value === '') {
    return [];
  }

  if (typeof value === 'string') {
    let parsed: unknown;

    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }

    return parsed;
  }

  if (!Array.isArray(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  return value;
}

function validateNumberConfig(
  min: number | undefined,
  max: number | undefined,
  step: number | undefined,
): void {
  if (
    (min !== undefined && max !== undefined && min > max) ||
    (step !== undefined && step <= 0)
  ) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }
}

function validateNumberValue(
  value: unknown,
  min: number | undefined,
  max: number | undefined,
  step: number | undefined,
  error: string,
): asserts value is number {
  assertFiniteNumber(value, error);

  if (
    (min !== undefined && value < min) ||
    (max !== undefined && value > max)
  ) {
    throw new Error(error);
  }

  if (step !== undefined) {
    const base = min ?? 0;
    const quotient = (value - base) / step;

    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      throw new Error(error);
    }
  }
}

function normalizeParameter(value: unknown): CrosstabParameter {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  const { id, kind, name, label, defaultValue, min, max, step, unit } = value;

  if (kind !== 'number') {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  assertNonEmptyString(id);
  assertNonEmptyString(name);
  assertNonEmptyString(label);
  assertFiniteNumber(defaultValue, ERR_CROSSTAB_PARAMETER_CONFIG);
  assertOptionalFiniteNumber(min);
  assertOptionalFiniteNumber(max);
  assertOptionalFiniteNumber(step);
  assertOptionalString(unit);
  validateNumberConfig(min, max, step);
  validateNumberValue(
    defaultValue,
    min,
    max,
    step,
    ERR_CROSSTAB_PARAMETER_CONFIG,
  );

  return {
    id,
    kind,
    name,
    label,
    defaultValue,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(unit === undefined ? {} : { unit }),
  };
}

function assertUniqueParameterKeys(parameters: CrosstabParameter[]): void {
  const ids = new Set<string>();
  const names = new Set<string>();

  parameters.forEach(parameter => {
    if (ids.has(parameter.id) || names.has(parameter.name)) {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }

    ids.add(parameter.id);
    names.add(parameter.name);
  });
}

export function getCrosstabParameters(
  formData: CrosstabFormData,
): CrosstabParameter[] {
  assertNoLegacyV4Inputs(formData, ERR_CROSSTAB_PARAMETER_CONFIG);
  const parameters = parseParameterInput(formData.crosstabParameters).map(
    normalizeParameter,
  );

  assertUniqueParameterKeys(parameters);

  return parameters;
}

function validateParameterValue(
  parameter: CrosstabParameter,
  value: number,
): void {
  validateNumberValue(
    value,
    parameter.min,
    parameter.max,
    parameter.step,
    ERR_CROSSTAB_PARAMETER_VALUE,
  );
}

export function resolveCrosstabParameters(
  formData: CrosstabFormData,
  ownState?: CrosstabOwnState,
): ResolvedCrosstabParameters {
  const config = getCrosstabParameters(formData);
  const values: Record<string, number> = {};

  config.forEach(parameter => {
    const ownValue = ownState?.numericParameters?.[parameter.id];
    const value = ownValue === undefined ? parameter.defaultValue : ownValue;

    validateParameterValue(parameter, value);
    values[parameter.id] = value;
  });

  return { config, values };
}

function encodeSignaturePart(value: string): string {
  return value.replace(
    /[%|=:]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function getParameterSignature(
  resolved: ResolvedCrosstabParameters,
): string {
  return [...resolved.config]
    .sort((left, right) => {
      if (left.id < right.id) {
        return -1;
      }

      if (left.id > right.id) {
        return 1;
      }

      return 0;
    })
    .map(
      parameter =>
        `number:${encodeSignaturePart(parameter.id)}=${
          resolved.values[parameter.id]
        }`,
    )
    .join('|');
}
