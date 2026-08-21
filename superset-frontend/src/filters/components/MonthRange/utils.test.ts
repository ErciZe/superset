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
  decodeMonthRange,
  encodeMonthRange,
  isRelativeMonthRange,
  normalizeMonthRange,
} from './utils';

test('encodes a selected month range using whole-month bounds', () => {
  expect(
    encodeMonthRange(extendedDayjs('2026-01-15'), extendedDayjs('2026-07-03')),
  ).toBe('2026-01-01T00:00:00 : 2026-08-01T00:00:00');
});

test('decodes a concrete month range for picker display', () => {
  const range = decodeMonthRange('2026-01-01T00:00:00 : 2026-08-01T00:00:00');

  expect(range?.[0].format('YYYY-MM')).toBe('2026-01');
  expect(range?.[1].format('YYYY-MM')).toBe('2026-07');
});

test('encodes and decodes a whole-month range across a year boundary', () => {
  const value = encodeMonthRange(
    extendedDayjs('2026-11-30'),
    extendedDayjs('2027-01-02'),
  );

  expect(value).toBe('2026-11-01T00:00:00 : 2027-02-01T00:00:00');
  expect(
    decodeMonthRange(value)?.map(month => month.format('YYYY-MM')),
  ).toEqual(['2026-11', '2027-01']);
});

test('decodes Current month as the same month on both picker bounds', () => {
  const currentMonth = extendedDayjs().format('YYYY-MM');

  expect(
    decodeMonthRange('Current month')?.map(month => month.format('YYYY-MM')),
  ).toEqual([currentMonth, currentMonth]);
});

test('decodes relative months in the configured time zone', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-31T16:30:00Z'));

  try {
    expect(
      decodeMonthRange('Current month', 'Asia/Shanghai')?.map(month =>
        month.format('YYYY-MM'),
      ),
    ).toEqual(['2026-09', '2026-09']);
    expect(
      decodeMonthRange('Current year', 'Asia/Shanghai')?.map(month =>
        month.format('YYYY-MM'),
      ),
    ).toEqual(['2026-01', '2026-12']);
  } finally {
    jest.useRealTimers();
  }
});

test('rejects concrete ranges that do not start at a month boundary', () => {
  expect(
    decodeMonthRange('2026-01-02T00:00:00 : 2026-03-01T00:00:00'),
  ).toBeUndefined();
});

test('rejects concrete ranges that do not end at a month boundary', () => {
  expect(
    decodeMonthRange('2026-01-01T00:00:00 : 2026-03-02T00:00:00'),
  ).toBeUndefined();
});

test('does not decode non-month time range values', () => {
  expect(decodeMonthRange('Last 30 days')).toBeUndefined();
});

test('normalizes a relative month range to concrete bounds', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-31T16:30:00Z'));

  try {
    expect(normalizeMonthRange('Current month', 'Asia/Shanghai')).toBe(
      '2026-09-01T00:00:00 : 2026-10-01T00:00:00',
    );
  } finally {
    jest.useRealTimers();
  }
});

test('rejects a multi-month value in single month mode', () => {
  expect(
    normalizeMonthRange(
      '2026-01-01T00:00:00 : 2026-03-01T00:00:00',
      undefined,
      'single',
    ),
  ).toBeUndefined();
});

test('identifies only supported rolling month values', () => {
  expect(isRelativeMonthRange('Current month')).toBe(true);
  expect(isRelativeMonthRange('Current year')).toBe(true);
  expect(isRelativeMonthRange('Last 30 days')).toBe(false);
});
