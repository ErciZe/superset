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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { DateRangeFrame } from '../components/DateRangeFrame';

const TODAY = '2026-06-03T10:15:00';

jest.useFakeTimers({ advanceTimers: true });
jest.setSystemTime(new Date(TODAY).getTime());

afterAll(() => {
  jest.useRealTimers();
});

const getStartDateInput = () => screen.getByLabelText('Start date');
const getEndDateInput = () => screen.getByLabelText('End date');

test('concrete incoming value initializes displayed inclusive start and end values', () => {
  render(
    <DateRangeFrame
      value="2026-06-01T00:00:00 : 2026-06-04T00:00:00"
      onChange={jest.fn()}
    />,
  );

  expect(getStartDateInput()).toHaveValue('2026-06-01');
  expect(getEndDateInput()).toHaveValue('2026-06-03');
  expect(getStartDateInput()).toHaveAttribute('readonly');
  expect(getEndDateInput()).toHaveAttribute('readonly');
});

test('concrete incoming value updates displayed values when the prop changes', () => {
  const { rerender } = render(
    <DateRangeFrame
      value="2026-06-01T00:00:00 : 2026-06-04T00:00:00"
      onChange={jest.fn()}
    />,
  );

  rerender(
    <DateRangeFrame
      value="2026-07-10T00:00:00 : 2026-07-12T00:00:00"
      onChange={jest.fn()}
    />,
  );

  expect(getStartDateInput()).toHaveValue('2026-07-10');
  expect(getEndDateInput()).toHaveValue('2026-07-11');
});

test('non-concrete incoming value initializes to today and renders selected range title', () => {
  const onChange = jest.fn();
  render(<DateRangeFrame value="Last 7 days" onChange={onChange} />);

  expect(screen.getByText('Selected range')).toBeInTheDocument();
  expect(getStartDateInput()).toHaveValue('2026-06-03');
  expect(getEndDateInput()).toHaveValue('2026-06-03');
  expect(onChange).toHaveBeenCalledWith(
    '2026-06-03T00:00:00 : 2026-06-04T00:00:00',
  );
});

test('clicking an inclusive calendar range emits an exclusive-end Superset range', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeFrame
      value="2026-06-01T00:00:00 : 2026-06-04T00:00:00"
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'June 10, 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'June 12, 2026' }));

  expect(onChange).toHaveBeenLastCalledWith(
    '2026-06-10T00:00:00 : 2026-06-13T00:00:00',
  );
  expect(getStartDateInput()).toHaveValue('2026-06-10');
  expect(getEndDateInput()).toHaveValue('2026-06-12');
});

test('clicking the Yesterday shortcut emits an exclusive-end Superset range', async () => {
  const onChange = jest.fn();
  render(
    <DateRangeFrame
      value="2026-06-01T00:00:00 : 2026-06-04T00:00:00"
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Yesterday' }));

  expect(onChange).toHaveBeenLastCalledWith(
    '2026-06-02T00:00:00 : 2026-06-03T00:00:00',
  );
  expect(getStartDateInput()).toHaveValue('2026-06-02');
  expect(getEndDateInput()).toHaveValue('2026-06-02');
});
