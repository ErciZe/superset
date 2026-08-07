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
import { useCallback, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Dayjs } from 'dayjs';
import '@testing-library/jest-dom';
// eslint-disable-next-line no-restricted-imports
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import MonthRangeFilterPlugin from './MonthRangeFilterPlugin';
import type { MonthRangeFilterProps } from './types';

jest.mock('src/hooks/useLocale', () => ({
  useLocale: () => undefined,
}));

jest.mock('@superset-ui/core/components', () => {
  const { extendedDayjs } = jest.requireActual('@superset-ui/core/utils/dates');

  return {
    AntdThemeProvider: ({ children }: { children: ReactNode }) => children,
    FormItem: ({ children }: { children: ReactNode }) => children,
    DatePicker: ({
      onChange,
      value,
    }: {
      onChange: (value: Dayjs | null) => void;
      value: Dayjs | null;
    }) => (
      <div>
        <span data-test="single-month-value">
          {value?.format('YYYY-MM') ?? 'empty'}
        </span>
        <button
          onClick={() => onChange(extendedDayjs('2027-03-12'))}
          type="button"
        >
          Select single month
        </button>
        <button onClick={() => onChange(null)} type="button">
          Clear single month
        </button>
      </div>
    ),
    RangePicker: ({
      onChange,
      value,
    }: {
      onChange: (value: [Dayjs, Dayjs] | null) => void;
      value: [Dayjs, Dayjs] | null;
    }) => (
      <div>
        <span data-test="month-range-value">
          {value
            ? `${value[0].format('YYYY-MM')} : ${value[1].format('YYYY-MM')}`
            : 'empty'}
        </span>
        <button
          onClick={() =>
            onChange([extendedDayjs('2026-11-12'), extendedDayjs('2027-01-09')])
          }
          type="button"
        >
          Select month range
        </button>
        <button onClick={() => onChange(null)} type="button">
          Clear month range
        </button>
      </div>
    ),
  };
});

const renderPlugin = (component: ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

const createProps = (
  overrides: Partial<MonthRangeFilterProps> = {},
): MonthRangeFilterProps => ({
  behaviors: [],
  data: [],
  formData: {
    datasource: '3__table',
    viz_type: 'filter_month_range',
    groupby: [],
    adhoc_filters: [],
    extra_filters: [],
    extra_form_data: {},
    granularity_sqla: 'ds',
    time_range_endpoints: ['inclusive', 'exclusive'],
    url_params: {},
    height: 300,
    width: 300,
    nativeFilterId: 'filter-1',
    defaultValue: null,
    inView: true,
  },
  filterState: {
    value: undefined,
  },
  height: 300,
  width: 300,
  inputRef: { current: null },
  setDataMask: jest.fn(),
  setFilterActive: jest.fn(),
  setHoveredFilter: jest.fn(),
  unsetHoveredFilter: jest.fn(),
  setFocusedFilter: jest.fn(),
  unsetFocusedFilter: jest.fn(),
  ...overrides,
});

function RelativeDefaultHarness({
  onSetDataMask,
}: {
  onSetDataMask: MonthRangeFilterProps['setDataMask'];
}) {
  const [value, setValue] =
    useState<MonthRangeFilterProps['filterState']['value']>('Current month');
  const setDataMask = useCallback<MonthRangeFilterProps['setDataMask']>(
    dataMask => {
      onSetDataMask(dataMask);
      setValue(dataMask.filterState?.value);
    },
    [onSetDataMask],
  );
  const props = createProps({
    filterState: { value },
    formData: {
      ...createProps().formData,
      monthTimeZone: 'Asia/Shanghai',
    },
    setDataMask,
  });

  return <MonthRangeFilterPlugin {...props} />;
}

function UnstableCallbackHarness({
  onSetDataMask,
}: {
  onSetDataMask: MonthRangeFilterProps['setDataMask'];
}) {
  const [, forceRender] = useState(0);
  const props = createProps({
    filterState: { value: 'Current month' },
    setDataMask: dataMask => {
      onSetDataMask(dataMask);
      forceRender(value => value + 1);
    },
  });

  return <MonthRangeFilterPlugin {...props} />;
}

test('normalizes a zoned Current month default without an effect loop', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-31T16:30:00Z'));
  const setDataMask = jest.fn();

  try {
    renderPlugin(<RelativeDefaultHarness onSetDataMask={setDataMask} />);

    expect(screen.getByTestId('month-range-value')).toHaveTextContent(
      '2026-09 : 2026-09',
    );
    expect(setDataMask).toHaveBeenCalledTimes(1);
    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: {
        time_range: '2026-09-01T00:00:00 : 2026-10-01T00:00:00',
      },
      filterState: {
        value: '2026-09-01T00:00:00 : 2026-10-01T00:00:00',
      },
    });
  } finally {
    jest.useRealTimers();
  }
});

test('waits for visible form data before normalizing a rolling default', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-31T16:30:00Z'));
  const setDataMask = jest.fn();
  const hiddenProps = createProps({
    filterState: { value: 'Current month' },
    formData: {
      ...createProps().formData,
      inView: false,
    },
    setDataMask,
  });

  try {
    const { rerender } = renderPlugin(
      <MonthRangeFilterPlugin {...hiddenProps} />,
    );
    expect(setDataMask).not.toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={supersetTheme}>
        <MonthRangeFilterPlugin
          {...hiddenProps}
          formData={{
            ...hiddenProps.formData,
            inView: true,
            monthTimeZone: 'Asia/Shanghai',
          }}
        />
      </ThemeProvider>,
    );

    expect(setDataMask).toHaveBeenCalledTimes(1);
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        time_range: '2026-09-01T00:00:00 : 2026-10-01T00:00:00',
      },
      filterState: {
        value: '2026-09-01T00:00:00 : 2026-10-01T00:00:00',
      },
    });
  } finally {
    jest.useRealTimers();
  }
});

test('normalizes once when the setDataMask callback identity changes', () => {
  const setDataMask = jest.fn();

  renderPlugin(<UnstableCallbackHarness onSetDataMask={setDataMask} />);

  expect(setDataMask).toHaveBeenCalledTimes(1);
});

test('normalizes a zoned Current year default to concrete month bounds', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-12-31T16:30:00Z'));
  const setDataMask = jest.fn();
  const props = createProps({
    filterState: { value: 'Current year' },
    formData: {
      ...createProps().formData,
      monthTimeZone: 'Asia/Shanghai',
    },
    setDataMask,
  });

  try {
    renderPlugin(<MonthRangeFilterPlugin {...props} />);

    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: {
        time_range: '2026-01-01T00:00:00 : 2027-01-01T00:00:00',
      },
      filterState: {
        value: '2026-01-01T00:00:00 : 2027-01-01T00:00:00',
      },
    });
  } finally {
    jest.useRealTimers();
  }
});

test('applies selected months as a concrete whole-month time range', async () => {
  const setDataMask = jest.fn();
  const props = createProps({ setDataMask });
  renderPlugin(<MonthRangeFilterPlugin {...props} />);

  await userEvent.click(
    screen.getByRole('button', { name: 'Select month range' }),
  );

  expect(setDataMask).toHaveBeenLastCalledWith({
    extraFormData: {
      time_range: '2026-11-01T00:00:00 : 2027-02-01T00:00:00',
    },
    filterState: {
      value: '2026-11-01T00:00:00 : 2027-02-01T00:00:00',
    },
  });
});

test('clears the data mask when the selected range is cleared', async () => {
  const setDataMask = jest.fn();
  const props = createProps({
    filterState: {
      value: '2026-01-01T00:00:00 : 2026-03-01T00:00:00',
    },
    setDataMask,
  });
  renderPlugin(<MonthRangeFilterPlugin {...props} />);

  await userEvent.click(
    screen.getByRole('button', { name: 'Clear month range' }),
  );

  expect(setDataMask).toHaveBeenLastCalledWith({
    extraFormData: {},
    filterState: { value: undefined },
  });
});

test('rejects an invalid partial-month default instead of querying it', () => {
  const setDataMask = jest.fn();
  const props = createProps({
    filterState: {
      value: '2026-01-02T00:00:00 : 2026-03-01T00:00:00',
    },
    setDataMask,
  });

  renderPlugin(<MonthRangeFilterPlugin {...props} />);

  expect(screen.getByTestId('month-range-value')).toHaveTextContent('empty');
  expect(setDataMask).toHaveBeenLastCalledWith({
    extraFormData: {},
    filterState: { value: undefined },
  });
});

test('single mode displays and applies exactly one month', async () => {
  const setDataMask = jest.fn();
  const props = createProps({
    formData: {
      ...createProps().formData,
      monthSelectionMode: 'single',
    },
    filterState: {
      value: '2026-05-01T00:00:00 : 2026-06-01T00:00:00',
    },
    setDataMask,
  });
  renderPlugin(<MonthRangeFilterPlugin {...props} />);

  expect(screen.getByTestId('single-month-value')).toHaveTextContent('2026-05');
  await userEvent.click(
    screen.getByRole('button', { name: 'Select single month' }),
  );
  expect(setDataMask).toHaveBeenLastCalledWith({
    extraFormData: {
      time_range: '2027-03-01T00:00:00 : 2027-04-01T00:00:00',
    },
    filterState: {
      value: '2027-03-01T00:00:00 : 2027-04-01T00:00:00',
    },
  });
});

test('single mode rejects a multi-month default instead of querying it', () => {
  const setDataMask = jest.fn();
  const props = createProps({
    formData: {
      ...createProps().formData,
      monthSelectionMode: 'single',
    },
    filterState: {
      value: '2026-05-01T00:00:00 : 2026-08-01T00:00:00',
    },
    setDataMask,
  });

  renderPlugin(<MonthRangeFilterPlugin {...props} />);

  expect(screen.getByTestId('single-month-value')).toHaveTextContent('empty');
  expect(setDataMask).toHaveBeenLastCalledWith({
    extraFormData: {},
    filterState: { value: undefined },
  });
});
