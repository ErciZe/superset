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
import {
  DateRangeShortcut,
  EASY_DATE_RANGE_FRAME,
  encodeInclusiveDateRange,
  getDateRangeShortcuts,
  parseConcreteDateRange,
} from '../utils/dateRangeUtils';

test('easy date range frame has a stable label', () => {
  expect(EASY_DATE_RANGE_FRAME).toBe('Date range');
});

test('encodeInclusiveDateRange converts the UI end date to an exclusive Superset end', () => {
  const startDate = extendedDayjs.utc('2026-06-01T12:30:00');
  const endDate = extendedDayjs.utc('2026-06-03T23:59:59');

  expect(encodeInclusiveDateRange(startDate, endDate)).toBe(
    '2026-06-01T00:00:00 : 2026-06-04T00:00:00',
  );
});

test('encodeInclusiveDateRange preserves local calendar dates without UTC shifting', () => {
  const startDate = extendedDayjs('2026-06-01T00:00:00');
  const endDate = extendedDayjs('2026-06-03T00:00:00');

  expect(encodeInclusiveDateRange(startDate, endDate)).toBe(
    '2026-06-01T00:00:00 : 2026-06-04T00:00:00',
  );
});

test('parseConcreteDateRange converts a Superset exclusive end into an inclusive UI end', () => {
  const parsed = parseConcreteDateRange(
    '2026-06-01T00:00:00 : 2026-06-04T00:00:00',
  );

  expect(parsed?.startDate.format('YYYY-MM-DD')).toBe('2026-06-01');
  expect(parsed?.endDate.format('YYYY-MM-DD')).toBe('2026-06-03');
});

test('parseConcreteDateRange returns undefined for non-concrete ranges', () => {
  expect(parseConcreteDateRange('Last 7 days')).toBeUndefined();
  expect(
    parseConcreteDateRange('DATEADD(DATETIME("now"), -7, day) : now'),
  ).toBeUndefined();
  expect(
    parseConcreteDateRange('2026-02-31T00:00:00 : 2026-03-02T00:00:00'),
  ).toBeUndefined();
  expect(
    parseConcreteDateRange('2026-06-03T00:00:00 : 2026-06-03T00:00:00'),
  ).toBeUndefined();
});

test('parseConcreteDateRange rejects non-midnight concrete ranges', () => {
  expect(
    parseConcreteDateRange('2026-06-01T12:00:00 : 2026-06-04T00:00:00'),
  ).toBeUndefined();
  expect(
    parseConcreteDateRange('2026-06-01T00:00:00 : 2026-06-04T12:00:00'),
  ).toBeUndefined();
});

test('parseConcreteDateRange rejects non-exact range separators', () => {
  expect(
    parseConcreteDateRange('2026-06-01T00:00:00  :  2026-06-04T00:00:00'),
  ).toBeUndefined();
  expect(
    parseConcreteDateRange('2026-06-01T00:00:00\t:\t2026-06-04T00:00:00'),
  ).toBeUndefined();
  expect(
    parseConcreteDateRange('2026-06-01T00:00:00\n:\n2026-06-04T00:00:00'),
  ).toBeUndefined();
});

test('shortcuts produce explicit Superset time range strings', () => {
  const baseDate = extendedDayjs.utc('2026-06-03T10:15:00');
  const shortcuts = getDateRangeShortcuts(baseDate);
  const shortcutByKey = new Map(
    shortcuts.map(shortcut => [shortcut.key, shortcut] as const),
  );

  const expectedTimeRanges = new Map<DateRangeShortcut, string>([
    [DateRangeShortcut.Today, '2026-06-03T00:00:00 : 2026-06-04T00:00:00'],
    [DateRangeShortcut.Yesterday, '2026-06-02T00:00:00 : 2026-06-03T00:00:00'],
    [DateRangeShortcut.Last7Days, '2026-05-28T00:00:00 : 2026-06-04T00:00:00'],
    [DateRangeShortcut.Last30Days, '2026-05-05T00:00:00 : 2026-06-04T00:00:00'],
    [
      DateRangeShortcut.CurrentWeek,
      '2026-05-31T00:00:00 : 2026-06-07T00:00:00',
    ],
    [
      DateRangeShortcut.CurrentMonth,
      '2026-06-01T00:00:00 : 2026-07-01T00:00:00',
    ],
    [
      DateRangeShortcut.CurrentQuarter,
      '2026-04-01T00:00:00 : 2026-07-01T00:00:00',
    ],
    [
      DateRangeShortcut.CurrentYear,
      '2026-01-01T00:00:00 : 2027-01-01T00:00:00',
    ],
    [
      DateRangeShortcut.PreviousWeek,
      '2026-05-24T00:00:00 : 2026-05-31T00:00:00',
    ],
    [
      DateRangeShortcut.PreviousMonth,
      '2026-05-01T00:00:00 : 2026-06-01T00:00:00',
    ],
    [
      DateRangeShortcut.PreviousQuarter,
      '2026-01-01T00:00:00 : 2026-04-01T00:00:00',
    ],
    [
      DateRangeShortcut.PreviousYear,
      '2025-01-01T00:00:00 : 2026-01-01T00:00:00',
    ],
  ]);

  expect(shortcuts).toHaveLength(expectedTimeRanges.size);
  expect([...shortcutByKey.keys()]).toEqual([...expectedTimeRanges.keys()]);
  expectedTimeRanges.forEach((timeRange, key) => {
    expect(shortcutByKey.get(key)?.timeRange).toBe(timeRange);
  });
});

test('shortcuts default to the local calendar day', () => {
  jest.isolateModules(() => {
    const actualDates = jest.requireActual(
      '@superset-ui/core/utils/dates',
    ) as typeof import('@superset-ui/core/utils/dates');
    const mockedExtendedDayjs = Object.assign(
      jest.fn((...args: Parameters<typeof actualDates.extendedDayjs>) =>
        actualDates.extendedDayjs(
          args.length > 0 ? args[0] : '2026-06-03T10:15:00',
          args[1],
          args[2],
        ),
      ),
      {
        utc: jest.fn(() => actualDates.extendedDayjs('2026-06-04T10:15:00')),
      },
    );

    jest.doMock('@superset-ui/core/utils/dates', () => ({
      ...actualDates,
      extendedDayjs: mockedExtendedDayjs,
    }));

    const {
      DateRangeShortcut: MockedDateRangeShortcut,
      getDateRangeShortcuts: getMockedDateRangeShortcuts,
    } = jest.requireActual(
      '../utils/dateRangeUtils',
    ) as typeof import('../utils/dateRangeUtils');
    const shortcuts = getMockedDateRangeShortcuts();
    const today = shortcuts.find(
      shortcut => shortcut.key === MockedDateRangeShortcut.Today,
    );

    expect(mockedExtendedDayjs).toHaveBeenCalledWith();
    expect(mockedExtendedDayjs.utc).not.toHaveBeenCalled();
    expect(today?.timeRange).toBe('2026-06-03T00:00:00 : 2026-06-04T00:00:00');
  });
});
