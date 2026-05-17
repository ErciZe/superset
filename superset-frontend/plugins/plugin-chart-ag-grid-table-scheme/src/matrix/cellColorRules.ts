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
import {
  Comparator,
  ConditionalFormattingConfig,
  getColorFunction,
  MultipleValueComparators,
} from '@superset-ui/chart-controls';
import type { DataRecord, DataRecordValue } from '@superset-ui/core';
import type { CellClassParams } from '@superset-ui/core/components/ThemedAgGridReact';
import type { CSSProperties } from 'react';
import { getMatrixRawValueField } from './matrixTransform';

export const MATRIX_CELL_COLOR_RULE_COLUMN = 'matrix_value_cells';

type MatrixCellColorFormatter = {
  column: string;
  getColorFromValue: (
    value: DataRecordValue,
    params: Pick<CellClassParams, 'data'>,
  ) => string | undefined;
};

type MatrixCellColorFormatterConfig = {
  rules?: ConditionalFormattingConfig[];
  generatedColumnIds: string[];
  data: DataRecord[];
  theme?: Record<string, any>;
};

type MatrixAdditionalCellStyle = (
  params: CellClassParams,
) => Partial<CSSProperties> | undefined;

const isFiniteNumber = (value: DataRecordValue): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidRule = (rule: ConditionalFormattingConfig) => {
  if (
    rule.column !== MATRIX_CELL_COLOR_RULE_COLUMN ||
    rule.operator === undefined ||
    rule.colorScheme === undefined
  ) {
    return false;
  }
  if (MultipleValueComparators.includes(rule.operator)) {
    return (
      rule.targetValueLeft !== undefined && rule.targetValueRight !== undefined
    );
  }
  if (rule.operator === Comparator.None) {
    return false;
  }
  return rule.targetValue !== undefined;
};

const resolveColor = (
  colorScheme: string | undefined,
  theme?: Record<string, any>,
) => {
  if (
    typeof colorScheme === 'string' &&
    colorScheme.startsWith('color') &&
    theme?.[colorScheme]
  ) {
    return theme[colorScheme] as string;
  }
  return colorScheme;
};

export function getMatrixCellColorFormatters({
  rules,
  generatedColumnIds,
  data,
  theme,
}: MatrixCellColorFormatterConfig): MatrixCellColorFormatter[] {
  const validRules = rules?.filter(isValidRule) ?? [];
  if (!validRules.length) {
    return [];
  }

  return generatedColumnIds.map(columnId => {
    const rawValueField = getMatrixRawValueField(columnId);
    const columnValues = data
      .map(row => row[rawValueField])
      .filter(isFiniteNumber);
    const colorFunctions = validRules.map(rule =>
      getColorFunction(
        {
          ...rule,
          colorScheme: resolveColor(rule.colorScheme, theme),
        },
        columnValues,
        false,
      ),
    );

    return {
      column: columnId,
      getColorFromValue: (_value, params) => {
        const rawValue = params.data?.[rawValueField];
        if (!isFiniteNumber(rawValue)) {
          return undefined;
        }
        let color: string | undefined;
        colorFunctions.forEach(getColor => {
          const nextColor = getColor(rawValue);
          if (nextColor) {
            color = nextColor;
          }
        });
        return color;
      },
    };
  });
}

export const createMatrixCellStyle = (
  formatters: MatrixCellColorFormatter[],
): MatrixAdditionalCellStyle | undefined => {
  if (!formatters.length) {
    return undefined;
  }
  const formatterByColumn = new Map(
    formatters.map(formatter => [formatter.column, formatter]),
  );

  return params => {
    const columnId = params.colDef.field;
    if (!columnId) {
      return undefined;
    }
    const color = formatterByColumn
      .get(columnId)
      ?.getColorFromValue(params.value, params);
    return color ? { backgroundColor: color } : undefined;
  };
};
