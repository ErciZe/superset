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
import { useState } from 'react';
import type { Dayjs } from 'dayjs';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import {
  DateRangeValue,
  getDateRangeShortcuts,
  startOfDate,
} from '../utils/dateRangeUtils';

const MAX_SHORTCUTS = 5;

export type DateRangeCalendarPanelProps = DateRangeValue & {
  baseDate?: Dayjs;
  onChange: (range: DateRangeValue) => void;
};

const PanelWrapper = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const ShortcutColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
  width: ${({ theme }) => theme.sizeUnit * 28}px;
`;

const ShortcutButton = styled(Button)`
  justify-content: flex-start;
  text-align: left;
  width: 100%;
`;

const MonthsGrid = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const MonthWrapper = styled.div`
  min-width: ${({ theme }) => theme.sizeUnit * 56}px;
`;

const MonthHeader = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorText};
    font-weight: ${theme.fontWeightStrong};
    margin-bottom: ${theme.sizeUnit * 2}px;
    text-align: center;
  `}
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, ${({ theme }) => theme.sizeUnit * 8}px);
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const WeekdayHeader = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: ${theme.sizeUnit * 7}px;
    text-align: center;
  `}
`;

const DayButton = styled.button`
  ${({ theme }) => css`
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorText};
    cursor: pointer;
    display: flex;
    height: ${theme.sizeUnit * 8}px;
    justify-content: center;
    padding: 0;
    width: ${theme.sizeUnit * 8}px;

    &:hover,
    &:focus-visible {
      background: ${theme.colorFillSecondary};
      outline: none;
    }

    &.is-outside-month {
      color: ${theme.colorTextQuaternary};
    }

    &.is-in-range {
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimaryText};
    }

    &.is-selected {
      background: ${theme.colorPrimary};
      color: ${theme.colorTextLightSolid};
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

export const getMonthDays = (month: Dayjs): Dayjs[] => {
  const firstDay = month.startOf('month').startOf('week');
  return Array.from({ length: 42 }, (_, index) => firstDay.add(index, 'day'));
};

export const isSameDay = (left: Dayjs, right: Dayjs): boolean =>
  left.isSame(right, 'day');

export const isInSelectedRange = (
  day: Dayjs,
  startDate: Dayjs,
  endDate: Dayjs,
): boolean =>
  isSameDay(day, startDate) ||
  isSameDay(day, endDate) ||
  (day.isAfter(startDate, 'day') && day.isBefore(endDate, 'day'));

export const renderMonth = (
  month: Dayjs,
  startDate: Dayjs,
  endDate: Dayjs,
  selectDate: (day: Dayjs) => void,
) => {
  const weekdays = getMonthDays(month).slice(0, 7);

  return (
    <MonthWrapper key={month.format('YYYY-MM')}>
      <MonthHeader>{month.format('MMMM YYYY')}</MonthHeader>
      <CalendarGrid>
        {weekdays.map(day => (
          <WeekdayHeader key={day.format('dddd')}>
            {day.format('dd')}
          </WeekdayHeader>
        ))}
        {getMonthDays(month).map(day => {
          const outsideMonth = !day.isSame(month, 'month');
          const selected = isSameDay(day, startDate) || isSameDay(day, endDate);
          const inRange = isInSelectedRange(day, startDate, endDate);
          return (
            <DayButton
              aria-label={day.format('MMMM D, YYYY')}
              aria-pressed={selected}
              className={[
                outsideMonth && 'is-outside-month',
                selected && 'is-selected',
                inRange && 'is-in-range',
              ]
                .filter(Boolean)
                .join(' ')}
              key={day.format('YYYY-MM-DD')}
              onClick={() => selectDate(day)}
              type="button"
            >
              {day.format('D')}
            </DayButton>
          );
        })}
      </CalendarGrid>
    </MonthWrapper>
  );
};

export function DateRangeCalendarPanel({
  startDate,
  endDate,
  baseDate,
  onChange,
}: DateRangeCalendarPanelProps) {
  const [pendingStartDate, setPendingStartDate] = useState<Dayjs | null>(null);
  const firstMonth = startOfDate(startDate).startOf('month');
  const secondMonth = firstMonth.add(1, 'month');
  const shortcuts = getDateRangeShortcuts(baseDate).slice(0, MAX_SHORTCUTS);

  const selectShortcut = (range: DateRangeValue) => {
    setPendingStartDate(null);
    onChange(range);
  };

  const selectDate = (date: Dayjs) => {
    const selected = startOfDate(date);
    if (!pendingStartDate) {
      setPendingStartDate(selected);
      onChange({ startDate: selected, endDate: selected });
      return;
    }
    const nextStart = selected.isBefore(pendingStartDate, 'day')
      ? selected
      : pendingStartDate;
    const nextEnd = selected.isBefore(pendingStartDate, 'day')
      ? pendingStartDate
      : selected;
    setPendingStartDate(null);
    onChange({ startDate: nextStart, endDate: nextEnd });
  };

  return (
    <PanelWrapper>
      <ShortcutColumn>
        {shortcuts.map(shortcut => (
          <ShortcutButton
            buttonStyle="secondary"
            key={shortcut.key}
            onClick={() =>
              selectShortcut({
                startDate: shortcut.startDate,
                endDate: shortcut.endDate,
              })
            }
          >
            {shortcut.label}
          </ShortcutButton>
        ))}
      </ShortcutColumn>
      <MonthsGrid>
        {renderMonth(firstMonth, startDate, endDate, selectDate)}
        {renderMonth(secondMonth, startDate, endDate, selectDate)}
      </MonthsGrid>
    </PanelWrapper>
  );
}
