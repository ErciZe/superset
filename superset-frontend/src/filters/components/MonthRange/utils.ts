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
import type { Dayjs } from 'dayjs';
import { parseConcreteDateRange } from 'src/explore/components/controls/DateFilterControl/utils/dateRangeUtils';
import { DAYJS_FORMAT } from 'src/explore/components/controls/DateFilterControl/utils/constants';
import {
  CurrentMonth,
  CurrentYear,
} from 'src/explore/components/controls/DateFilterControl/types';
import type { MonthSelectionMode } from './types';

const DATE_RANGE_SEPARATOR = ' : ';

export type MonthRange = [Dayjs, Dayjs];

export function isRelativeMonthRange(
  value: unknown,
): value is typeof CurrentMonth | typeof CurrentYear {
  return value === CurrentMonth || value === CurrentYear;
}

export function encodeMonthRange(startMonth: Dayjs, endMonth: Dayjs): string {
  const since = startMonth.startOf('month').format(DAYJS_FORMAT);
  const until = endMonth.startOf('month').add(1, 'month').format(DAYJS_FORMAT);
  return `${since}${DATE_RANGE_SEPARATOR}${until}`;
}

export function decodeMonthRange(
  value: unknown,
  monthTimeZone?: string,
): MonthRange | undefined {
  const relativeRangeBase = () =>
    monthTimeZone ? extendedDayjs().tz(monthTimeZone) : extendedDayjs();

  if (value === CurrentMonth) {
    const currentMonth = relativeRangeBase().startOf('month');
    return [currentMonth, currentMonth];
  }

  if (value === CurrentYear) {
    const currentMonth = relativeRangeBase();
    return [
      currentMonth.startOf('year'),
      currentMonth.endOf('year').startOf('month'),
    ];
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const range = parseConcreteDateRange(value);
  if (!range) {
    return undefined;
  }

  const startsOnMonthBoundary = range.startDate.isSame(
    range.startDate.startOf('month'),
    'day',
  );
  const endsOnMonthBoundary = range.endDate.isSame(
    range.endDate.endOf('month'),
    'day',
  );
  if (!startsOnMonthBoundary || !endsOnMonthBoundary) {
    return undefined;
  }

  return [range.startDate.startOf('month'), range.endDate.startOf('month')];
}

export function normalizeMonthRange(
  value: unknown,
  monthTimeZone?: string,
  monthSelectionMode: MonthSelectionMode = 'range',
): string | undefined {
  const months = decodeMonthRange(value, monthTimeZone);
  if (
    !months ||
    (monthSelectionMode === 'single' && !months[0].isSame(months[1], 'month'))
  ) {
    return undefined;
  }
  return encodeMonthRange(months[0], months[1]);
}
