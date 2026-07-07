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
import { render, screen } from 'spec/helpers/testing-library';
import TimeFilterChartPlugin from '.';
import TimeFilterPlugin from './TimeFilterPlugin';
import { PluginFilterTimeProps } from './types';

jest.mock('src/explore/components/controls/DateFilterControl', () => ({
  __esModule: true,
  default: ({ enableEasyDateRange }: { enableEasyDateRange?: boolean }) => {
    if (enableEasyDateRange === undefined) {
      return <span>easy-missing</span>;
    }
    return (
      <span>{enableEasyDateRange ? 'easy-enabled' : 'easy-disabled'}</span>
    );
  },
}));

const baseProps: PluginFilterTimeProps = {
  behaviors: [],
  data: [],
  formData: {
    datasource: '3__table',
    viz_type: 'filter_time',
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
    value: null,
    validateStatus: undefined,
    validateMessage: undefined,
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
};

test('passes enabled easy date range flag from native filter form data', () => {
  render(
    <TimeFilterPlugin
      {...baseProps}
      formData={{
        ...baseProps.formData,
        enableEasyDateRange: true,
      }}
    />,
  );

  expect(screen.getByText('easy-enabled')).toBeInTheDocument();
});

test('omits easy date range flag without native filter form data flag', () => {
  render(<TimeFilterPlugin {...baseProps} />);

  expect(screen.getByText('easy-missing')).toBeInTheDocument();
});

test('disables no-results placeholder for empty time filter queries', () => {
  const plugin = new TimeFilterChartPlugin();

  expect(plugin.metadata.enableNoResults).toBe(false);
});
