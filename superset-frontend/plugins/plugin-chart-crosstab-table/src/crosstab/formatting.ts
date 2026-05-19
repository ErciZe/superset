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

export type CrosstabConditionalStyle = Pick<
  CSSProperties,
  'color' | 'backgroundColor'
> & {
  arrow?: 'up' | 'down';
};

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
