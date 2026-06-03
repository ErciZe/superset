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
import { useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Input } from '@superset-ui/core/components';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { FrameComponentProps } from 'src/explore/components/controls/DateFilterControl/types';
import {
  DateRangeValue,
  encodeInclusiveDateRange,
  parseConcreteDateRange,
  startOfDate,
} from '../utils/dateRangeUtils';
import { DateRangeCalendarPanel } from './DateRangeCalendarPanel';

const DATE_DISPLAY_FORMAT = 'YYYY-MM-DD';

const FrameWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const SelectedRangeFields = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ReadOnlyInput = styled(Input)`
  ${({ theme }) => css`
    max-width: ${theme.sizeUnit * 36}px;
  `}
`;

const getRangeFromValue = (value: string): DateRangeValue => {
  const concreteRange = parseConcreteDateRange(value);
  if (concreteRange) {
    return concreteRange;
  }
  const today = startOfDate(extendedDayjs());
  return { startDate: today, endDate: today };
};

export function DateRangeFrame({ value, onChange }: FrameComponentProps) {
  const [range, setRange] = useState<DateRangeValue>(() =>
    getRangeFromValue(value),
  );

  useEffect(() => {
    const concreteRange = parseConcreteDateRange(value);
    if (concreteRange) {
      setRange(concreteRange);
      return;
    }

    const nextRange = getRangeFromValue(value);
    setRange(nextRange);
    onChange(encodeInclusiveDateRange(nextRange.startDate, nextRange.endDate));
  }, [onChange, value]);

  const handleChange = (nextRange: DateRangeValue) => {
    setRange(nextRange);
    onChange(encodeInclusiveDateRange(nextRange.startDate, nextRange.endDate));
  };

  return (
    <FrameWrapper>
      <div className="section-title">{t('Selected range')}</div>
      <SelectedRangeFields>
        <ReadOnlyInput
          aria-label={t('Start date')}
          readOnly
          value={range.startDate.format(DATE_DISPLAY_FORMAT)}
        />
        <ReadOnlyInput
          aria-label={t('End date')}
          readOnly
          value={range.endDate.format(DATE_DISPLAY_FORMAT)}
        />
      </SelectedRangeFields>
      <DateRangeCalendarPanel
        startDate={range.startDate}
        endDate={range.endDate}
        onChange={handleChange}
      />
    </FrameWrapper>
  );
}
