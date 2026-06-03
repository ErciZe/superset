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
import { t } from '@apache-superset/core/translation';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import type { Dayjs } from 'dayjs';
import { DAYJS_FORMAT } from './constants';

export const EASY_DATE_RANGE_FRAME = 'Date range' as const;

export enum DateRangeShortcut {
  Today = 'today',
  Yesterday = 'yesterday',
  Last7Days = 'last_7_days',
  Last30Days = 'last_30_days',
  CurrentWeek = 'current_week',
  CurrentMonth = 'current_month',
  CurrentQuarter = 'current_quarter',
  CurrentYear = 'current_year',
  PreviousWeek = 'previous_week',
  PreviousMonth = 'previous_month',
  PreviousQuarter = 'previous_quarter',
  PreviousYear = 'previous_year',
}

export type DateRangeValue = {
  startDate: Dayjs;
  endDate: Dayjs;
};

export type DateRangeShortcutOption = DateRangeValue & {
  key: DateRangeShortcut;
  label: string;
  timeRange: string;
};

const DATE_RANGE_SEPARATOR = ' : ';
const CONCRETE_DATE_RANGE_PATTERN =
  /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d) : (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)$/;

export const startOfDate = (date: Dayjs) => date.startOf('day');

export const encodeInclusiveDateRange = (startDate: Dayjs, endDate: Dayjs) => {
  const since = startOfDate(startDate).format(DAYJS_FORMAT);
  const until = startOfDate(endDate).add(1, 'day').format(DAYJS_FORMAT);
  return `${since}${DATE_RANGE_SEPARATOR}${until}`;
};

export const parseConcreteDateRange = (
  timeRange: string,
): DateRangeValue | undefined => {
  const match = timeRange.match(CONCRETE_DATE_RANGE_PATTERN);
  if (!match) {
    return undefined;
  }
  const startDate = extendedDayjs(match[1], DAYJS_FORMAT, true);
  const exclusiveEnd = extendedDayjs(match[2], DAYJS_FORMAT, true);
  if (!startDate.isValid() || !exclusiveEnd.isValid()) {
    return undefined;
  }
  if (
    !startDate.isSame(startDate.startOf('day')) ||
    !exclusiveEnd.isSame(exclusiveEnd.startOf('day'))
  ) {
    return undefined;
  }
  const startDay = startDate.startOf('day');
  const endDate = exclusiveEnd.startOf('day').subtract(1, 'day');
  if (endDate.isBefore(startDay, 'day')) {
    return undefined;
  }
  return { startDate: startDay, endDate };
};

const buildShortcut = (
  key: DateRangeShortcut,
  label: string,
  startDate: Dayjs,
  endDate: Dayjs,
): DateRangeShortcutOption => ({
  key,
  label,
  startDate: startOfDate(startDate),
  endDate: startOfDate(endDate),
  timeRange: encodeInclusiveDateRange(startDate, endDate),
});

const startOfQuarter = (date: Dayjs) => {
  const quarterStartMonth = Math.floor(date.month() / 3) * 3;
  return date.month(quarterStartMonth).startOf('month');
};

const endOfQuarter = (date: Dayjs) =>
  startOfQuarter(date).add(3, 'months').subtract(1, 'day');

const startOfWeek = (date: Dayjs) =>
  startOfDate(date).subtract(date.day(), 'days');

const endOfWeek = (date: Dayjs) => startOfWeek(date).add(6, 'days');

export const getDateRangeShortcuts = (
  baseDate = extendedDayjs(),
): DateRangeShortcutOption[] => {
  const base = startOfDate(baseDate);
  return [
    buildShortcut(DateRangeShortcut.Today, t('Today'), base, base),
    buildShortcut(
      DateRangeShortcut.Yesterday,
      t('Yesterday'),
      base.subtract(1, 'day'),
      base.subtract(1, 'day'),
    ),
    buildShortcut(
      DateRangeShortcut.Last7Days,
      t('Last 7 days'),
      base.subtract(6, 'days'),
      base,
    ),
    buildShortcut(
      DateRangeShortcut.Last30Days,
      t('Last 30 days'),
      base.subtract(29, 'days'),
      base,
    ),
    buildShortcut(
      DateRangeShortcut.CurrentWeek,
      t('Current week'),
      startOfWeek(base),
      endOfWeek(base),
    ),
    buildShortcut(
      DateRangeShortcut.CurrentMonth,
      t('Current month'),
      base.startOf('month'),
      base.endOf('month'),
    ),
    buildShortcut(
      DateRangeShortcut.CurrentQuarter,
      t('Current quarter'),
      startOfQuarter(base),
      endOfQuarter(base),
    ),
    buildShortcut(
      DateRangeShortcut.CurrentYear,
      t('Current year'),
      base.startOf('year'),
      base.endOf('year'),
    ),
    buildShortcut(
      DateRangeShortcut.PreviousWeek,
      t('Previous week'),
      startOfWeek(base.subtract(1, 'week')),
      endOfWeek(base.subtract(1, 'week')),
    ),
    buildShortcut(
      DateRangeShortcut.PreviousMonth,
      t('Previous month'),
      base.subtract(1, 'month').startOf('month'),
      base.subtract(1, 'month').endOf('month'),
    ),
    buildShortcut(
      DateRangeShortcut.PreviousQuarter,
      t('Previous quarter'),
      startOfQuarter(base.subtract(3, 'months')),
      endOfQuarter(base.subtract(3, 'months')),
    ),
    buildShortcut(
      DateRangeShortcut.PreviousYear,
      t('Previous year'),
      base.subtract(1, 'year').startOf('year'),
      base.subtract(1, 'year').endOf('year'),
    ),
  ];
};
