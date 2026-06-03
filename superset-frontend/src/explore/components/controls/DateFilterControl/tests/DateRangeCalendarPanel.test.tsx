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
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { DateRangeCalendarPanel } from '../components/DateRangeCalendarPanel';

const startDate = extendedDayjs.utc('2026-06-01T00:00:00');
const endDate = extendedDayjs.utc('2026-06-03T00:00:00');
const baseDate = extendedDayjs.utc('2026-06-03T10:15:00');

const expectLastRange = (
  onChange: jest.Mock,
  expectedStartDate: string,
  expectedEndDate: string,
) => {
  const lastRange = onChange.mock.calls.at(-1)?.[0];
  expect(lastRange.startDate.format('YYYY-MM-DD')).toBe(expectedStartDate);
  expect(lastRange.endDate.format('YYYY-MM-DD')).toBe(expectedEndDate);
};

test('renders two adjacent months from the start date month and the first five shortcut actions', () => {
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText('June 2026')).toBeInTheDocument();
  expect(screen.getByText('July 2026')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Last 7 days' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Current week' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Current month' }),
  ).not.toBeInTheDocument();
});

test('selecting a start date and an inclusive end date emits the selected range', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'June 10, 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'June 12, 2026' }));

  expectLastRange(onChange, '2026-06-10', '2026-06-12');
});

test('selecting an end date before the pending start date normalizes the range', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'June 12, 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'June 10, 2026' }));

  expectLastRange(onChange, '2026-06-10', '2026-06-12');
});

test('clicking the Today shortcut emits the shortcut range from the base date', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      baseDate={baseDate}
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Today' }));

  expectLastRange(onChange, '2026-06-03', '2026-06-03');
});

test('clicking the Yesterday shortcut emits the shortcut range from the base date', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      baseDate={baseDate}
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Yesterday' }));

  expectLastRange(onChange, '2026-06-02', '2026-06-02');
});

test('clicking the Last 7 days shortcut emits the shortcut range from the base date', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      baseDate={baseDate}
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

  expectLastRange(onChange, '2026-05-28', '2026-06-03');
});

test('shortcut clicks clear pending calendar selection state', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      baseDate={baseDate}
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'June 10, 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Yesterday' }));
  await userEvent.click(screen.getByRole('button', { name: 'June 12, 2026' }));

  expectLastRange(onChange, '2026-06-12', '2026-06-12');
});

test('outside-month boundary dates are rendered as labelled day buttons', () => {
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      onChange={jest.fn()}
    />,
  );

  const boundaryButtons = screen.getAllByRole('button', {
    name: 'June 30, 2026',
  });
  expect(boundaryButtons).toHaveLength(2);
  expect(
    boundaryButtons.some(button =>
      button.classList.contains('is-outside-month'),
    ),
  ).toBe(true);
});

test('selected day buttons expose semantic pressed state', () => {
  render(
    <DateRangeCalendarPanel
      startDate={startDate}
      endDate={endDate}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'June 1, 2026' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: 'June 3, 2026' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: 'June 2, 2026' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
