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
import { AppSection, NO_TIME_RANGE } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  AntdThemeProvider,
  DatePicker,
  RangePicker,
} from '@superset-ui/core/components';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocale } from 'src/hooks/useLocale';
import { FilterPluginStyle } from '../common';
import { MonthRangeFilterProps } from './types';
import {
  decodeMonthRange,
  encodeMonthRange,
  normalizeMonthRange,
} from './utils';

const MonthRangeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow: visible;
  width: ${({ width }) => (width === 0 ? '200px' : `${width}px`)};
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  width: 100%;

  .ant-picker {
    flex: 1;
    min-width: 0;
  }
`;

export default function MonthRangeFilterPlugin(props: MonthRangeFilterProps) {
  const datePickerLocale = useLocale();
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
    isOverflowingFilterBar = false,
  } = props;
  const monthSelectionMode = props.formData.monthSelectionMode ?? 'range';
  const setDataMaskRef = useRef(setDataMask);
  setDataMaskRef.current = setDataMask;
  const emittedNormalizationRef = useRef<string | undefined>(undefined);
  const selectedMonths = useMemo(() => {
    const months = decodeMonthRange(
      filterState.value,
      props.formData.monthTimeZone,
    );
    if (
      monthSelectionMode === 'single' &&
      months &&
      !months[0].isSame(months[1], 'month')
    ) {
      return undefined;
    }
    return months;
  }, [filterState.value, monthSelectionMode, props.formData.monthTimeZone]);
  const normalizedTimeRange = normalizeMonthRange(
    filterState.value,
    props.formData.monthTimeZone,
    monthSelectionMode,
  );
  const currentTimeRange =
    typeof filterState.value === 'string' ? filterState.value : undefined;
  const normalizationKey =
    currentTimeRange !== normalizedTimeRange
      ? `${currentTimeRange ?? ''}\u0000${normalizedTimeRange ?? ''}`
      : undefined;

  const setTimeRange = useCallback((timeRange?: string) => {
    const isSet = timeRange && timeRange !== NO_TIME_RANGE;
    setDataMaskRef.current({
      extraFormData: isSet ? { time_range: timeRange } : {},
      filterState: { value: isSet ? timeRange : undefined },
    });
  }, []);

  useEffect(() => {
    if (!normalizationKey) {
      emittedNormalizationRef.current = undefined;
      return;
    }
    if (
      !props.formData.inView ||
      props.appSection === AppSection.FilterConfigModal ||
      emittedNormalizationRef.current === normalizationKey
    ) {
      return;
    }
    emittedNormalizationRef.current = normalizationKey;
    setTimeRange(normalizedTimeRange);
  }, [
    normalizationKey,
    normalizedTimeRange,
    props.appSection,
    props.formData.inView,
    setTimeRange,
  ]);

  const getPopupContainer = useCallback(
    (triggerNode: HTMLElement) =>
      isOverflowingFilterBar
        ? (triggerNode.parentNode as HTMLElement)
        : document.body,
    [isOverflowingFilterBar],
  );

  const applyMonthRange = useCallback(
    (startMonth: Dayjs, endMonth = startMonth) => {
      setTimeRange(encodeMonthRange(startMonth, endMonth));
    },
    [setTimeRange],
  );

  const handlePickerOpenChange = useCallback(
    (open: boolean) => {
      setFilterActive(open);
      if (!open) {
        unsetHoveredFilter();
        unsetFocusedFilter();
      }
    },
    [setFilterActive, unsetFocusedFilter, unsetHoveredFilter],
  );

  return props.formData?.inView ? (
    <MonthRangeFilterStyles width={width} height={height}>
      <Controls
        ref={inputRef}
        onClick={event => event.stopPropagation()}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseDown={event => event.stopPropagation()}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
      >
        <AntdThemeProvider locale={datePickerLocale ?? undefined}>
          {monthSelectionMode === 'single' ? (
            <DatePicker
              allowClear
              aria-label={t('Month')}
              format="YYYY-MM"
              getPopupContainer={getPopupContainer}
              onChange={month => {
                if (month) {
                  applyMonthRange(month);
                } else {
                  setTimeRange();
                }
              }}
              onOpenChange={handlePickerOpenChange}
              picker="month"
              placeholder={t('Month')}
              value={selectedMonths?.[0] ?? null}
            />
          ) : (
            <RangePicker
              allowClear
              aria-label={t('Range')}
              format="YYYY-MM"
              getPopupContainer={getPopupContainer}
              onChange={months => {
                if (months?.[0] && months[1]) {
                  applyMonthRange(months[0], months[1]);
                } else if (!months) {
                  setTimeRange();
                }
              }}
              onOpenChange={handlePickerOpenChange}
              picker="month"
              placeholder={[t('Month'), t('Month')]}
              value={selectedMonths ?? null}
            />
          )}
        </AntdThemeProvider>
      </Controls>
    </MonthRangeFilterStyles>
  ) : null;
}
