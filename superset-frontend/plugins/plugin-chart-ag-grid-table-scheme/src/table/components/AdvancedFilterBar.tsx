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
import { useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Button, Input, Select } from '@superset-ui/core/components';
import {
  AdvancedFilterOperator,
  AdvancedFilterState,
  SearchOption,
} from '../types';

const VALUELESS_OPERATORS = new Set<AdvancedFilterOperator>([
  'blank',
  'notBlank',
]);

const OPERATOR_OPTIONS: {
  value: AdvancedFilterOperator;
  label: string;
}[] = [
  { value: 'equals', label: '等于' },
  { value: 'notEqual', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'startsWith', label: '开头是' },
  { value: 'endsWith', label: '结尾是' },
  { value: 'lessThan', label: '小于' },
  { value: 'lessThanOrEqual', label: '小于等于' },
  { value: 'greaterThan', label: '大于' },
  { value: 'greaterThanOrEqual', label: '大于等于' },
  { value: 'blank', label: '为空' },
  { value: 'notBlank', label: '不为空' },
];

type AdvancedFilterBarProps = {
  searchOptions: SearchOption[];
  value?: AdvancedFilterState;
  onApply: (filter: AdvancedFilterState) => void;
  onClear: () => void;
};

export default function AdvancedFilterBar({
  searchOptions,
  value,
  onApply,
  onClear,
}: AdvancedFilterBarProps) {
  const fallbackColumn = searchOptions[0]?.value ?? '';
  const [column, setColumn] = useState(value?.column || fallbackColumn);
  const [operator, setOperator] = useState<AdvancedFilterOperator>(
    value?.operator || 'equals',
  );
  const [filterValue, setFilterValue] = useState(value?.value || '');

  useEffect(() => {
    setColumn(value?.column || fallbackColumn);
    setOperator(value?.operator || 'equals');
    setFilterValue(value?.value || '');
  }, [value?.column, value?.operator, value?.value, fallbackColumn]);

  const needsValue = !VALUELESS_OPERATORS.has(operator);
  const selectedColumnExists = useMemo(
    () => searchOptions.some(option => option.value === column),
    [column, searchOptions],
  );
  const effectiveColumn = selectedColumnExists ? column : fallbackColumn;
  const applyDisabled = !effectiveColumn || (needsValue && !filterValue.trim());

  if (!searchOptions.length) {
    return null;
  }

  return (
    <div className="advanced-filter-container">
      <Select
        className="advanced-filter-column"
        value={effectiveColumn}
        options={searchOptions}
        onChange={nextColumn => setColumn(String(nextColumn))}
        ariaLabel={t('Filter column')}
      />
      <Select
        className="advanced-filter-operator"
        value={operator}
        options={OPERATOR_OPTIONS}
        onChange={nextOperator =>
          setOperator(nextOperator as AdvancedFilterOperator)
        }
        ariaLabel={t('Filter operator')}
      />
      <Input
        className="advanced-filter-value"
        value={filterValue}
        disabled={!needsValue}
        placeholder={needsValue ? '筛选值' : ''}
        onChange={event => setFilterValue(event.target.value)}
        onPressEnter={() => {
          if (!applyDisabled) {
            onApply({ column: effectiveColumn, operator, value: filterValue });
          }
        }}
        aria-label={t('Filter value')}
      />
      <Button
        buttonStyle="primary"
        disabled={applyDisabled}
        onClick={() =>
          onApply({ column: effectiveColumn, operator, value: filterValue })
        }
      >
        筛选
      </Button>
      <Button
        buttonStyle="secondary"
        onClick={() => {
          setFilterValue('');
          onClear();
        }}
      >
        清空
      </Button>
    </div>
  );
}
