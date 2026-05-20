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
import { getNumberFormatter, type DataRecordValue } from '@superset-ui/core';
import type { CSSProperties } from 'react';
import type { CrosstabConditionalRule } from '../types';

export const ERR_CONDITIONAL_FORMATTING =
  'Invalid crosstab conditional formatting configuration.';

export type CrosstabConditionalStyle = Pick<
  CSSProperties,
  'color' | 'backgroundColor'
> & {
  arrow?: 'up' | 'down';
};

const SUPPORTED_OPERATORS = new Set(['>', '>=', '<', '<=', '=', '!=']);
const SUPPORTED_ARROWS = new Set(['up', 'down']);

function isConditionalRule(
  value: unknown,
): value is Partial<CrosstabConditionalRule> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseConditionalFormatting(
  value: CrosstabConditionalRule[] | string | null | undefined,
): CrosstabConditionalRule[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  let rules: unknown;

  try {
    rules = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error(ERR_CONDITIONAL_FORMATTING);
  }

  if (!Array.isArray(rules)) {
    throw new Error(ERR_CONDITIONAL_FORMATTING);
  }

  return rules.map(rule => {
    if (
      !isConditionalRule(rule) ||
      typeof rule.operator !== 'string' ||
      !SUPPORTED_OPERATORS.has(rule.operator) ||
      typeof rule.value !== 'number' ||
      !Number.isFinite(rule.value) ||
      (rule.metric !== undefined && typeof rule.metric !== 'string') ||
      (rule.color !== undefined && typeof rule.color !== 'string') ||
      (rule.backgroundColor !== undefined &&
        typeof rule.backgroundColor !== 'string') ||
      (rule.arrow !== undefined &&
        (typeof rule.arrow !== 'string' || !SUPPORTED_ARROWS.has(rule.arrow)))
    ) {
      throw new Error(ERR_CONDITIONAL_FORMATTING);
    }

    return {
      ...(rule.metric ? { metric: rule.metric } : {}),
      operator: rule.operator as CrosstabConditionalRule['operator'],
      value: rule.value,
      ...(rule.color ? { color: rule.color } : {}),
      ...(rule.backgroundColor
        ? { backgroundColor: rule.backgroundColor }
        : {}),
      ...(rule.arrow
        ? { arrow: rule.arrow as CrosstabConditionalRule['arrow'] }
        : {}),
    };
  });
}

function ruleMatches(value: number, rule: CrosstabConditionalRule) {
  switch (rule.operator) {
    case '>':
      return value > rule.value;
    case '>=':
      return value >= rule.value;
    case '<':
      return value < rule.value;
    case '<=':
      return value <= rule.value;
    case '=':
      return value === rule.value;
    case '!=':
      return value !== rule.value;
    default:
      return false;
  }
}

export function formatCrosstabValue(
  value: DataRecordValue | null | undefined,
  numberFormat?: string,
) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return getNumberFormatter(numberFormat)(value);
  }

  return String(value);
}

export function resolveConditionalStyle(
  value: DataRecordValue | null | undefined,
  rules: CrosstabConditionalRule[] = [],
): CrosstabConditionalStyle {
  if (typeof value !== 'number') {
    return {};
  }

  const match = rules.find(rule => ruleMatches(value, rule));
  if (!match) {
    return {};
  }

  const { color, backgroundColor, arrow } = match;
  return {
    ...(color ? { color } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(arrow ? { arrow } : {}),
  };
}
