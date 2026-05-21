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
  CrosstabNumberParameter,
  CrosstabOwnState,
} from '../types';

export const ERR_CROSSTAB_PARAMETER_CONFIG = 'ERR_CROSSTAB_PARAMETER_CONFIG';
export const ERR_CROSSTAB_PARAMETER_VALUE = 'ERR_CROSSTAB_PARAMETER_VALUE';

export type ResolvedCrosstabParameters = {
  config: CrosstabNumberParameter[];
  values: Record<string, number>;
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

function parseParameterInput(value: CrosstabFormData['parameters']): unknown[] {
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

function normalizeParameter(value: unknown): CrosstabNumberParameter {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  const {
    kind,
    name,
    label,
    default: defaultValue,
    min,
    max,
    step,
    unit,
  } = value;

  if (kind !== 'number' || typeof name !== 'string' || name.length === 0) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  assertFiniteNumber(defaultValue, ERR_CROSSTAB_PARAMETER_CONFIG);
  assertOptionalString(label);
  assertOptionalFiniteNumber(min);
  assertOptionalFiniteNumber(max);
  assertOptionalFiniteNumber(step);
  assertOptionalString(unit);

  if (
    (min !== undefined && max !== undefined && min > max) ||
    (step !== undefined && step <= 0)
  ) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  return {
    kind,
    name,
    ...(label === undefined ? {} : { label }),
    default: defaultValue,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(unit === undefined ? {} : { unit }),
  };
}

export function getCrosstabNumberParameters(
  formData: CrosstabFormData,
): CrosstabNumberParameter[] {
  const parameters = parseParameterInput(formData.parameters).map(
    normalizeParameter,
  );

  if (parameters.length > 1) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  return parameters;
}

function validateParameterValue(
  parameter: CrosstabNumberParameter,
  value: number,
): void {
  assertFiniteNumber(value, ERR_CROSSTAB_PARAMETER_VALUE);

  if (
    (parameter.min !== undefined && value < parameter.min) ||
    (parameter.max !== undefined && value > parameter.max)
  ) {
    throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
  }

  if (parameter.step !== undefined) {
    const base = parameter.min ?? 0;
    const quotient = (value - base) / parameter.step;

    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
    }
  }
}

export function resolveCrosstabParameters(
  formData: CrosstabFormData,
  ownState?: CrosstabOwnState,
): ResolvedCrosstabParameters {
  const config = getCrosstabNumberParameters(formData);
  const values: Record<string, number> = {};

  config.forEach(parameter => {
    const ownValue = ownState?.numericParameters?.[parameter.name];
    const value = ownValue === undefined ? parameter.default : ownValue;

    validateParameterValue(parameter, value);
    values[parameter.name] = value;
  });

  return { config, values };
}

export function getParameterSignature(
  resolved: ResolvedCrosstabParameters,
): string {
  return Object.keys(resolved.values)
    .sort()
    .map(name => `${name}=${resolved.values[name]}`)
    .join('\u001f');
}
