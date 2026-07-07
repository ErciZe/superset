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
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

import {
  render,
  screen,
  selectOption,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';

import { NO_TIME_RANGE } from '@superset-ui/core';
import DateFilterLabel from '..';
import { DateFilterControlProps } from '../types';
import { DateFilterTestKey } from '../utils';

const mockStore = configureStore([thunk]);

const defaultProps = {
  onChange: jest.fn(),
  onClosePopover: jest.fn(),
  onOpenPopover: jest.fn(),
};
const concreteDateRange = '2026-06-10T00:00:00 : 2026-06-13T00:00:00';

function setup(
  props: Omit<DateFilterControlProps, 'name'> = defaultProps,
  store: any = mockStore({}),
) {
  return (
    <Provider store={store}>
      <DateFilterLabel name="time_range" {...props} />
    </Provider>
  );
}

async function openRangeTypeDropdown() {
  await userEvent.click(screen.getByRole('combobox', { name: 'Range type' }));
  await waitFor(() =>
    expect(document.querySelector('.rc-virtual-list')).toBeInTheDocument(),
  );
  return document.querySelector('.rc-virtual-list') as HTMLElement;
}

test('DateFilter with default props', () => {
  render(setup());
  // label
  expect(screen.getByText(NO_TIME_RANGE)).toBeInTheDocument();

  // should be popover by default
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(
    screen.getByTestId(DateFilterTestKey.PopoverOverlay),
  ).toBeInTheDocument();
});

test('DateFilter should be applied the global config time_filter from the store', () => {
  render(
    setup(
      defaultProps,
      mockStore({
        common: { conf: { DEFAULT_TIME_FILTER: 'Last week' } },
      }),
    ),
  );
  // the label should be 'Last week'
  expect(screen.getByText('Last week')).toBeInTheDocument();

  userEvent.click(screen.getByText('Last week'));
  expect(screen.getByTestId(DateFilterTestKey.CommonFrame)).toBeInTheDocument();
});

test('Open and close popover', () => {
  render(setup());

  // click "Cancel"
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(defaultProps.onOpenPopover).toHaveBeenCalled();
  expect(screen.getByText('Edit time range')).toBeInTheDocument();
  userEvent.click(screen.getByText('Cancel'));
  expect(defaultProps.onClosePopover).toHaveBeenCalled();
  expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();

  // click "Apply"
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(defaultProps.onOpenPopover).toHaveBeenCalled();
  expect(screen.getByText('Edit time range')).toBeInTheDocument();
  userEvent.click(screen.getByText('Apply'));
  expect(defaultProps.onClosePopover).toHaveBeenCalled();
  expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();
});

test('DateFilter popover should attach to document.body when not overflowing', () => {
  render(setup({ ...defaultProps, isOverflowingFilterBar: false }));

  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popover = document.querySelector('.time-range-popover');
  expect(popover?.parentElement).toBe(document.body);
});

test('DateFilter popover should attach to parent node when overflowing in filter bar', () => {
  render(setup({ ...defaultProps, isOverflowingFilterBar: true }));

  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popover = document.querySelector('.time-range-popover');
  const trigger = screen.getByTestId(DateFilterTestKey.PopoverOverlay);

  expect(popover?.parentElement).toBe(trigger.parentElement);
});

test('DateFilter should properly handle isOverflowingFilterBar prop changes', () => {
  const { rerender } = render(
    setup({ ...defaultProps, isOverflowingFilterBar: false }),
  );

  // When not overflowing, popover should attach to document.body
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  const popover = document.querySelector('.time-range-popover');
  expect(popover?.parentElement).toBe(document.body);

  userEvent.click(screen.getByText('Cancel'));

  // When overflowing, popover should attach to parent node
  rerender(setup({ ...defaultProps, isOverflowingFilterBar: true }));
  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popoverAfterRerender = document.querySelector('.time-range-popover');
  const trigger = screen.getByTestId(DateFilterTestKey.PopoverOverlay);

  expect(popoverAfterRerender?.parentElement).toBe(trigger.parentElement);
  expect(popoverAfterRerender?.parentElement).not.toBe(document.body);
});

test('Date range frame option is hidden by default', async () => {
  render(setup());

  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  const optionsList = await openRangeTypeDropdown();
  expect(within(optionsList).queryByText('Date range')).not.toBeInTheDocument();
});

test('Date range frame option appears when enabled', async () => {
  render(setup({ ...defaultProps, enableEasyDateRange: true }));

  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  const optionsList = await openRangeTypeDropdown();
  expect(within(optionsList).getByText('Date range')).toBeInTheDocument();
});

test('Date range frame option is the first option when enabled', async () => {
  render(setup({ ...defaultProps, enableEasyDateRange: true }));

  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  const optionsList = await openRangeTypeDropdown();
  expect(within(optionsList).getAllByRole('option')[0]).toHaveTextContent(
    'Date range',
  );
});

test('Date range frame is shown by default for no filter when enabled', async () => {
  render(setup({ ...defaultProps, enableEasyDateRange: true }));

  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  expect(screen.getByText('Selected range')).toBeInTheDocument();
});

test('Date range frame renders selected range controls when selected', async () => {
  render(setup({ ...defaultProps, enableEasyDateRange: true }));

  await userEvent.click(screen.getByText(NO_TIME_RANGE));
  await selectOption('Date range', 'Range type');

  expect(screen.getByText('Selected range')).toBeInTheDocument();
});

test('Date range frame uses a wide popover for the two-month calendar', async () => {
  render(setup({ ...defaultProps, enableEasyDateRange: true }));

  await userEvent.click(screen.getByText(NO_TIME_RANGE));
  await selectOption('Date range', 'Range type');

  expect(document.querySelector('.time-range-popover')).toHaveStyle({
    width: '760px',
    maxWidth: 'calc(100vw - 32px)',
  });
});

test('Date range frame reopens for concrete ranges when enabled', async () => {
  render(
    setup({
      ...defaultProps,
      enableEasyDateRange: true,
      value: concreteDateRange,
    }),
  );

  await userEvent.click(screen.getByText(concreteDateRange));

  expect(screen.getByText('Selected range')).toBeInTheDocument();
  expect(screen.queryByTestId('custom-frame')).not.toBeInTheDocument();
});

test('Concrete ranges keep default custom frame when Date range is disabled', async () => {
  render(setup({ ...defaultProps, value: concreteDateRange }));

  await userEvent.click(screen.getByText(concreteDateRange));

  expect(screen.getByTestId('custom-frame')).toBeInTheDocument();
  expect(screen.queryByText('Selected range')).not.toBeInTheDocument();
});
