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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import AdvancedFilterBar from '../../../src/table/components/AdvancedFilterBar';
import { StyledChartContainer } from '../../../src/table/styles';

const searchOptions = [
  { value: 'platform_name', label: '平台' },
  { value: 'platform_order_name', label: '平台订单号' },
];

test('applies an advanced filter with the selected value', () => {
  const onApply = jest.fn();
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      onApply={onApply}
      onClear={jest.fn()}
    />,
  );

  userEvent.type(screen.getByLabelText('Filter value'), 'Amazon');
  userEvent.click(screen.getByRole('button', { name: /筛\s*选/ }));

  expect(onApply).toHaveBeenCalledWith({
    column: 'platform_name',
    operator: 'equals',
    value: 'Amazon',
  });
});

test('disables apply until value-based filters have a value', () => {
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      onApply={jest.fn()}
      onClear={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: /筛\s*选/ })).toBeDisabled();
});

test('supports valueless blank filters', () => {
  const onApply = jest.fn();
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      value={{ column: 'platform_name', operator: 'blank' }}
      onApply={onApply}
      onClear={jest.fn()}
    />,
  );

  expect(screen.getByLabelText('Filter value')).toBeDisabled();
  userEvent.click(screen.getByRole('button', { name: /筛\s*选/ }));

  expect(onApply).toHaveBeenCalledWith({
    column: 'platform_name',
    operator: 'blank',
    value: '',
  });
});

test('clears the local value and notifies the container', () => {
  const onClear = jest.fn();
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      value={{ column: 'platform_name', operator: 'equals', value: 'Amazon' }}
      onApply={jest.fn()}
      onClear={onClear}
    />,
  );

  userEvent.click(screen.getByRole('button', { name: /清\s*空/ }));

  expect(screen.getByLabelText('Filter value')).toHaveValue('');
  expect(onClear).toHaveBeenCalledTimes(1);
});

test('keeps the advanced filter controls on one row', () => {
  const { container } = render(
    <StyledChartContainer height={400}>
      <AdvancedFilterBar
        searchOptions={searchOptions}
        onApply={jest.fn()}
        onClear={jest.fn()}
      />
    </StyledChartContainer>,
  );

  expect(container.firstChild).toHaveStyleRule('flex-wrap', 'nowrap', {
    target: '.advanced-filter-container',
  });
  expect(container.firstChild).toHaveStyleRule('width', '152px', {
    target: '.advanced-filter-column',
  });
  expect(container.firstChild).toHaveStyleRule('width', '104px', {
    target: '.advanced-filter-operator',
  });
  expect(container.firstChild).toHaveStyleRule('width', '192px', {
    target: '.advanced-filter-value',
  });
});
