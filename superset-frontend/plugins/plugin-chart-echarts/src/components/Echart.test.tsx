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
import { render, waitFor } from '../../../../spec/helpers/testing-library';
import type { EChartsCoreOption } from 'echarts/core';
import Echart from './Echart';
import type { EchartsProps } from '../types';

type Handler = (params: unknown) => void;
type Listener = {
  query?: string;
  handler: Handler;
};

const listeners: Record<string, Listener[]> = {};

const mockChart = {
  dispatchAction: jest.fn(),
  dispose: jest.fn(),
  getOption: jest.fn(() => ({})),
  getZr: jest.fn(() => ({
    off: jest.fn(),
    on: jest.fn(),
  })),
  off: jest.fn((name: string, handler?: Handler) => {
    if (!handler) {
      delete listeners[name];
      return;
    }
    listeners[name] = (listeners[name] || []).filter(
      listener => listener.handler !== handler,
    );
  }),
  on: jest.fn(
    (name: string, queryOrHandler: string | Handler, handler?: Handler) => {
      listeners[name] = listeners[name] || [];
      listeners[name].push(
        handler
          ? { query: queryOrHandler as string, handler }
          : { handler: queryOrHandler as Handler },
      );
    },
  ),
  resize: jest.fn(),
  setOption: jest.fn(),
};

jest.mock('echarts/core', () => ({
  init: jest.fn(() => mockChart),
  registerLocale: jest.fn(),
  use: jest.fn(),
}));

const mockZhLocale = {
  time: {
    month: Array.from({ length: 12 }, (_, index) => `月${index + 1}`),
    monthAbbr: Array.from({ length: 12 }, (_, index) => `M${index + 1}`),
    dayOfWeek: Array.from({ length: 7 }, (_, index) => `日${index + 1}`),
    dayOfWeekAbbr: Array.from({ length: 7 }, (_, index) => `D${index + 1}`),
  },
};

const mockPtLocale = { time: { month: ['Janeiro'] } };
const mockNbLocale = { time: { month: ['Januar'] } };

jest.mock('echarts/i18n/langEN-obj.js', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('echarts/i18n/langZH-obj.js', () => ({
  __esModule: true,
  default: mockZhLocale,
}));

jest.mock('echarts/i18n/langPT-br-obj.js', () => ({
  __esModule: true,
  default: mockPtLocale,
}));

jest.mock('echarts/i18n/langnb-NO-obj.js', () => ({
  __esModule: true,
  default: mockNbLocale,
}));

jest.mock('echarts/charts', () => ({
  BarChart: 'BarChart',
  BoxplotChart: 'BoxplotChart',
  CustomChart: 'CustomChart',
  FunnelChart: 'FunnelChart',
  GaugeChart: 'GaugeChart',
  GraphChart: 'GraphChart',
  HeatmapChart: 'HeatmapChart',
  LineChart: 'LineChart',
  PieChart: 'PieChart',
  RadarChart: 'RadarChart',
  SankeyChart: 'SankeyChart',
  ScatterChart: 'ScatterChart',
  SunburstChart: 'SunburstChart',
  TreeChart: 'TreeChart',
  TreemapChart: 'TreemapChart',
}));

jest.mock('echarts/components', () => ({
  AriaComponent: 'AriaComponent',
  DataZoomComponent: 'DataZoomComponent',
  GraphicComponent: 'GraphicComponent',
  GridComponent: 'GridComponent',
  LegendComponent: 'LegendComponent',
  MarkAreaComponent: 'MarkAreaComponent',
  MarkLineComponent: 'MarkLineComponent',
  TitleComponent: 'TitleComponent',
  ToolboxComponent: 'ToolboxComponent',
  TooltipComponent: 'TooltipComponent',
  VisualMapComponent: 'VisualMapComponent',
}));

jest.mock('echarts/features', () => ({
  LabelLayout: 'LabelLayout',
}));

jest.mock('echarts/renderers', () => ({
  CanvasRenderer: 'CanvasRenderer',
}));

const initialState = {
  common: {
    locale: 'en',
  },
  dashboardState: {
    isRefreshing: false,
  },
};

const defaultProps: EchartsProps = {
  echartOptions: { series: [] } as EChartsCoreOption,
  height: 100,
  refs: {},
  width: 100,
};

const renderEchart = (props: Partial<EchartsProps> = {}) => (
  <Echart {...defaultProps} {...props} />
);

type EchartsCoreMock = {
  init: jest.Mock;
  registerLocale: jest.Mock;
};

const getEchartsCoreMock = () =>
  jest.requireMock('echarts/core') as EchartsCoreMock;

const trigger = (name: string) => {
  (listeners[name] || []).forEach(listener => listener.handler({}));
};

beforeEach(() => {
  Object.keys(listeners).forEach(name => {
    delete listeners[name];
  });
  Object.values(mockChart).forEach(value => {
    if (jest.isMockFunction(value)) {
      value.mockClear();
    }
  });
  const echartsCore = getEchartsCoreMock();
  echartsCore.init.mockClear();
  echartsCore.registerLocale.mockClear();
  echartsCore.init.mockImplementation(() => mockChart);
  echartsCore.registerLocale.mockImplementation(() => undefined);
});

test('registers locale data from locale object modules before chart init', async () => {
  const { init, registerLocale } = getEchartsCoreMock();
  const calls: string[] = [];
  registerLocale.mockImplementation(() => calls.push('registerLocale'));
  init.mockImplementation(() => {
    calls.push('init');
    return mockChart;
  });

  render(renderEchart(), {
    initialState: { ...initialState, common: { locale: 'zh' } },
    useRedux: true,
  });

  await waitFor(() => expect(init).toHaveBeenCalled());

  expect(registerLocale).toHaveBeenCalledWith('ZH', mockZhLocale);
  expect(calls).toEqual(['registerLocale', 'init']);
});

test('normalizes regional locales before loading locale object modules', async () => {
  const cases = [
    ['pt_BR', 'PT-BR', mockPtLocale],
    ['nb_NO', 'NB-NO', mockNbLocale],
  ] as const;

  for (const [sourceLocale, echartsLocale, localeObject] of cases) {
    const { init, registerLocale } = getEchartsCoreMock();
    const { unmount } = render(renderEchart(), {
      initialState: { ...initialState, common: { locale: sourceLocale } },
      useRedux: true,
    });

    await waitFor(() =>
      expect(registerLocale).toHaveBeenCalledWith(echartsLocale, localeObject),
    );
    expect(init).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      null,
      expect.objectContaining({ locale: echartsLocale }),
    );
    unmount();
    registerLocale.mockClear();
    init.mockClear();
  }
});

test('replaces stale query event handlers without clearing regular event handlers', async () => {
  const regularClickHandler = jest.fn();
  const firstQueryHandler = jest.fn();
  const secondQueryHandler = jest.fn();

  const { rerender } = render(
    renderEchart({
      eventHandlers: {
        click: regularClickHandler,
      },
      queryEventHandlers: [
        {
          handler: firstQueryHandler,
          name: 'click',
          query: 'xAxis.category',
        },
      ],
    }),
    { initialState, useRedux: true },
  );

  await waitFor(() =>
    expect(mockChart.on).toHaveBeenCalledWith(
      'click',
      'xAxis.category',
      firstQueryHandler,
    ),
  );

  rerender(
    renderEchart({
      eventHandlers: {
        click: regularClickHandler,
      },
      queryEventHandlers: [
        {
          handler: secondQueryHandler,
          name: 'click',
          query: 'xAxis.category',
        },
      ],
    }),
  );

  await waitFor(() =>
    expect(mockChart.on).toHaveBeenCalledWith(
      'click',
      'xAxis.category',
      secondQueryHandler,
    ),
  );

  trigger('click');

  expect(regularClickHandler).toHaveBeenCalledTimes(1);
  expect(firstQueryHandler).not.toHaveBeenCalled();
  expect(secondQueryHandler).toHaveBeenCalledTimes(1);

  regularClickHandler.mockClear();
  secondQueryHandler.mockClear();

  rerender(
    renderEchart({
      eventHandlers: {
        click: regularClickHandler,
      },
      queryEventHandlers: [],
    }),
  );

  await waitFor(() =>
    expect(mockChart.off).toHaveBeenCalledWith('click', secondQueryHandler),
  );

  trigger('click');

  expect(regularClickHandler).toHaveBeenCalledTimes(1);
  expect(firstQueryHandler).not.toHaveBeenCalled();
  expect(secondQueryHandler).not.toHaveBeenCalled();
});
