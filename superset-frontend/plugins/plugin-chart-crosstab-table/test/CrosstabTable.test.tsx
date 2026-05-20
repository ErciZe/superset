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
import '@testing-library/jest-dom';
import { GenericDataType } from '@superset-ui/core';
import type { ComponentProps, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import type { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import CrosstabTable from '../src/CrosstabTable';
import {
  CROSSTAB_ROW_LABEL,
  CROSSTAB_ROW_LEVEL,
  CROSSTAB_ROW_PATH,
  CROSSTAB_ROW_TYPE,
  CROSSTAB_TOTAL_COLUMN_ID,
  encodeCrosstabRowPath,
} from '../src/crosstab/engine';
import type { CrosstabChartProps } from '../src/types';

const mockExportDataAsCsv = jest.fn();
let container: HTMLDivElement;
type TestColumnDef = ColDef & {
  children?: TestColumnDef[];
};

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');

  return {
    ...actual,
    useTheme: () => ({
      colorFillSecondary: 'rgba(0, 0, 0, 0.06)',
    }),
  };
});

jest.mock('@superset-ui/core/components', () => {
  const ReactActual = jest.requireActual('react');
  type MockGridProps = {
    autoGroupColumnDef?: ColDef;
    className?: string;
    columnDefs: TestColumnDef[];
    getDataPath?: (row: Record<string, unknown>) => string[];
    getRowStyle?: (params: {
      data: Record<string, unknown>;
    }) => CSSProperties | undefined;
    groupDefaultExpanded?: number;
    rowData: Record<string, unknown>[];
    style?: CSSProperties;
    treeData?: boolean;
  };
  type MockSelectOption = {
    label?: string | number;
    value: string | number;
  };
  type MockSelectProps = {
    allowSelectAll?: boolean;
    ariaLabel?: string;
    onChange?: (value: string) => void;
    options: MockSelectOption[];
    value?: string | number | null;
  };
  const flattenColumnDefs = (
    columnDefs: TestColumnDef[],
  ): { groups: string[]; leaves: ColDef[] } =>
    columnDefs.reduce<{ groups: string[]; leaves: ColDef[] }>(
      (result, columnDef) => {
        if (Array.isArray(columnDef.children)) {
          const childResult = flattenColumnDefs(columnDef.children);

          return {
            groups: [
              ...result.groups,
              columnDef.headerName ?? '',
              ...childResult.groups,
            ],
            leaves: [...result.leaves, ...childResult.leaves],
          };
        }

        return {
          groups: result.groups,
          leaves: [...result.leaves, columnDef],
        };
      },
      { groups: [], leaves: [] },
    );

  // eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
  class MockAgGridReact extends ReactActual.Component<MockGridProps> {
    api = { exportDataAsCsv: mockExportDataAsCsv };

    render() {
      const {
        autoGroupColumnDef,
        columnDefs,
        className,
        getDataPath,
        getRowStyle,
        groupDefaultExpanded,
        rowData,
        style,
        treeData,
      } = this.props as MockGridProps;
      const { groups, leaves } = flattenColumnDefs(columnDefs);

      return (
        <div className={className} style={style}>
          <div className="ag-center-cols-viewport" />
          <table
            data-group-depth={groupDefaultExpanded}
            data-tree-data={treeData ? 'true' : 'false'}
          >
            <thead>
              <tr>
                {autoGroupColumnDef && <th>{autoGroupColumnDef.headerName}</th>}
                {groups.map(group => (
                  <th key={group}>{group}</th>
                ))}
                {leaves.map(columnDef => (
                  <th key={columnDef.colId}>{columnDef.headerName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowData.map((row, rowIndex) => {
                const rowStyle = getRowStyle?.({ data: row });

                return (
                  <tr key={rowIndex} style={rowStyle}>
                    {getDataPath && <td>{getDataPath(row).join(' / ')}</td>}
                    {leaves.map(columnDef => {
                      const value =
                        typeof columnDef.valueGetter === 'function'
                          ? columnDef.valueGetter({
                              data: row,
                              node: undefined,
                              column: undefined,
                              colDef: columnDef,
                              api: undefined,
                              context: undefined,
                            } as never)
                          : row[columnDef.field ?? ''];
                      const style =
                        typeof columnDef.cellStyle === 'function'
                          ? columnDef.cellStyle({
                              value,
                              data: row,
                              node: undefined,
                              column: undefined,
                              colDef: columnDef,
                              api: undefined,
                              context: undefined,
                            } as never)
                          : columnDef.cellStyle;
                      const rendered =
                        typeof columnDef.cellRenderer === 'function'
                          ? columnDef.cellRenderer({
                              value,
                              data: row,
                              node: undefined,
                              colDef: columnDef,
                              api: undefined,
                              context: undefined,
                            } as never)
                          : undefined;
                      const formatted =
                        typeof columnDef.valueFormatter === 'function'
                          ? columnDef.valueFormatter({
                              value,
                              data: row,
                              node: undefined,
                              column: undefined,
                              colDef: columnDef,
                              api: undefined,
                              context: undefined,
                            } as never)
                          : value;

                      return (
                        <td key={columnDef.colId} style={style as never}>
                          {(rendered ?? formatted) as string}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
  }

  return {
    Button: ({
      children,
      htmlType,
      onClick,
      ...props
    }: ComponentProps<'button'> & {
      buttonSize?: string;
      htmlType?: ComponentProps<'button'>['type'];
    }) => {
      const buttonProps = { ...props };
      delete buttonProps.buttonSize;

      return (
        <button
          type={htmlType === 'submit' ? 'submit' : 'button'}
          onClick={onClick}
          {...buttonProps}
        >
          {children}
        </button>
      );
    },
    Select: ({
      allowSelectAll,
      ariaLabel,
      onChange,
      options,
      value,
    }: MockSelectProps) => (
      <>
        <select
          aria-label={ariaLabel}
          data-allow-select-all={allowSelectAll ? 'true' : 'false'}
          onChange={event => onChange?.(event.target.value)}
          value={value ?? ''}
        >
          {options.map(option => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          aria-label="Trigger invalid mock select change"
          onClick={() => onChange?.('__invalid_groupby_column__')}
          type="button"
        />
      </>
    ),
    ThemedAgGridReact: MockAgGridReact,
  };
});

describe('CrosstabTable', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockExportDataAsCsv.mockClear();
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  function renderChart(props: CrosstabChartProps) {
    act(() => {
      ReactDOM.render(<CrosstabTable {...props} />, container);
    });
  }

  function getByText(text: string) {
    const match = Array.from(container.querySelectorAll('*'))
      .reverse()
      .find(element => element.textContent === text);
    if (!(match instanceof HTMLElement)) {
      throw new Error(`Unable to find text: ${text}`);
    }
    return match;
  }

  function getTable() {
    const table = container.querySelector('table');
    if (!(table instanceof HTMLTableElement)) {
      throw new Error('Unable to find table');
    }
    return table;
  }

  function getExportButton() {
    const button = container.querySelector(
      'button[aria-label="Export crosstab CSV"]',
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Unable to find export button');
    }
    return button;
  }

  function getDynamicGroupBySelect() {
    const select = container.querySelector(
      'select[aria-label="Select crosstab group by dimension"]',
    );
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Unable to find dynamic group-by select');
    }
    return select;
  }

  function getInvalidSelectChangeButton() {
    const button = container.querySelector(
      'button[aria-label="Trigger invalid mock select change"]',
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Unable to find invalid select change button');
    }
    return button;
  }

  function getGridContainer() {
    const gridContainer = container.querySelector(
      '[data-test="crosstab-grid-container"]',
    );
    if (!(gridContainer instanceof HTMLElement)) {
      throw new Error('Unable to find crosstab grid container');
    }
    return gridContainer;
  }

  function getPaginationFooter() {
    const footer = container.querySelector(
      '[data-test="crosstab-table-footer"]',
    );
    if (!(footer instanceof HTMLElement)) {
      throw new Error('Unable to find crosstab table footer');
    }
    return footer;
  }

  function baseHierarchicalProps(
    defaultRowExpandedDepth: number,
    expandedRowPaths?: string[],
  ) {
    return {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        defaultRowExpandedDepth,
      },
      expandedRowPaths,
      rowData: [
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
          [CROSSTAB_ROW_LABEL]: 'A',
          [CROSSTAB_ROW_LEVEL]: 0,
          [CROSSTAB_ROW_TYPE]: 'group',
          contract_type: 'A',
          year: null,
          '__crosstab_col__string:4:Cash__metric__amount': 12,
        },
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A', '2026']),
          [CROSSTAB_ROW_LABEL]: '2026',
          [CROSSTAB_ROW_LEVEL]: 1,
          [CROSSTAB_ROW_TYPE]: 'leaf',
          contract_type: 'A',
          year: '2026',
          '__crosstab_col__string:4:Cash__metric__amount': 12,
        },
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A', 'Subtotal']),
          [CROSSTAB_ROW_LABEL]: 'Subtotal',
          [CROSSTAB_ROW_LEVEL]: 1,
          [CROSSTAB_ROW_TYPE]: 'subtotal',
          contract_type: 'A',
          year: null,
          '__crosstab_col__string:4:Cash__metric__amount': 12,
        },
      ],
      columns: [
        {
          key: 'contract_type',
          label: 'contract_type',
          dataType: GenericDataType.String,
        },
        {
          key: 'year',
          label: 'year',
          dataType: GenericDataType.String,
        },
        {
          key: '__crosstab_col__string:4:Cash__metric__amount',
          label: 'Cash amount',
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        },
      ],
      columnTree: [
        {
          id: 'string:4:Cash',
          label: 'Cash',
          field: '__crosstab_col__string:4:Cash__metric__amount',
          metric: 'amount',
        },
      ],
      generatedColumnIds: ['__crosstab_col__string:4:Cash__metric__amount'],
    } as unknown as CrosstabChartProps;
  }

  it('renders row dimension values and formatted generated cells', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        numberFormat: ',.1f',
      },
      rowData: [
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
          [CROSSTAB_ROW_LABEL]: 'A',
          [CROSSTAB_ROW_TYPE]: 'leaf',
          '__crosstab_col__string:4:Cash__metric__amount': 1234.56,
        },
      ],
      columns: [
        {
          key: 'contract_type',
          label: 'contract_type',
          dataType: GenericDataType.String,
        },
        {
          key: '__crosstab_col__string:4:Cash__metric__amount',
          label: 'Cash amount',
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        },
      ],
      columnTree: [
        {
          id: 'string:4:Cash',
          label: 'Cash',
          children: [
            {
              id: '__crosstab_col__string:4:Cash__metric__amount',
              label: 'amount',
              field: '__crosstab_col__string:4:Cash__metric__amount',
              metric: 'amount',
            },
          ],
        },
      ],
      generatedColumnIds: ['__crosstab_col__string:4:Cash__metric__amount'],
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(container.querySelector('[data-test="crosstab-table"]')).toHaveStyle(
      {
        height: '400px',
        width: '800px',
      },
    );
    expect(getByText('A')).toBeInTheDocument();
    expect(getByText('1,234.6')).toBeInTheDocument();
  });

  it('keeps the grid inside the remaining chart height below toolbar controls', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(container.querySelector('[data-test="crosstab-table"]')).toHaveStyle(
      {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0',
        overflow: 'hidden',
      },
    );
    expect(getGridContainer()).toHaveStyle({
      flex: '1 1 auto',
      minHeight: '0',
      minWidth: '0',
      overflow: 'hidden',
    });
  });

  it('renders conditional arrows and total row styling', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        numberFormat: ',.0f',
        conditionalFormatting: [
          {
            metric: 'amount',
            operator: '>=',
            value: 10,
            color: 'green',
            backgroundColor: 'white',
            arrow: 'up',
          },
        ],
      },
      rowData: [
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
          [CROSSTAB_ROW_LABEL]: 'A',
          [CROSSTAB_ROW_TYPE]: 'leaf',
          contract_type: 'A',
          '__crosstab_col__string:4:Cash__metric__amount': 12,
        },
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A', 'Subtotal']),
          [CROSSTAB_ROW_LABEL]: 'Subtotal',
          [CROSSTAB_ROW_TYPE]: 'subtotal',
          '__crosstab_col__string:4:Cash__metric__amount': 2,
        },
      ],
      columns: [
        {
          key: 'contract_type',
          label: 'contract_type',
          dataType: GenericDataType.String,
        },
        {
          key: '__crosstab_col__string:4:Cash__metric__amount',
          label: 'Cash amount',
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        },
      ],
      columnTree: [
        {
          id: 'string:4:Cash',
          label: 'Cash',
          children: [
            {
              id: '__crosstab_col__string:4:Cash__metric__amount',
              label: 'amount',
              field: '__crosstab_col__string:4:Cash__metric__amount',
              metric: 'amount',
            },
          ],
        },
      ],
      generatedColumnIds: ['__crosstab_col__string:4:Cash__metric__amount'],
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('↑ 12')).toHaveStyle({
      color: 'green',
      backgroundColor: 'white',
    });
    expect(getByText('2')).toHaveStyle({
      color: '',
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
    });

    const subtotalRow = getByText('Subtotal').closest('tr');
    expect(subtotalRow).toBeInstanceOf(HTMLTableRowElement);
    expect(subtotalRow).toHaveStyle({
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
      fontWeight: '600',
    });
  });

  it('renders pinned row columns and nested column group headers', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        defaultRowExpandedDepth: 2,
      },
      rowData: [
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A', '2026']),
          [CROSSTAB_ROW_TYPE]: 'leaf',
          contract_type: 'A',
          '__crosstab_col__string:4:2026|string:4:Cash__metric__amount': 10,
        },
      ],
      columns: [
        {
          key: 'contract_type',
          label: 'contract_type',
          dataType: GenericDataType.String,
        },
        {
          key: '__crosstab_col__string:4:2026|string:4:Cash__metric__amount',
          label: 'amount',
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        },
      ],
      columnTree: [
        {
          id: 'string:4:2026',
          label: '2026',
          children: [
            {
              id: 'string:4:2026|string:4:Cash',
              label: 'Cash',
              children: [
                {
                  id: '__crosstab_col__string:4:2026|string:4:Cash__metric__amount',
                  label: 'amount',
                  field:
                    '__crosstab_col__string:4:2026|string:4:Cash__metric__amount',
                  metric: 'amount',
                },
              ],
            },
          ],
        },
      ],
      generatedColumnIds: [
        '__crosstab_col__string:4:2026|string:4:Cash__metric__amount',
      ],
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('2026')).toBeInTheDocument();
    expect(getByText('Cash')).toBeInTheDocument();
    expect(getByText('contract_type')).toBeInTheDocument();
    expect(getByText('A')).toBeInTheDocument();
    expect(getTable()).toHaveAttribute('data-tree-data', 'false');
  });

  it('uses defaultRowExpandedDepth to control initially visible hierarchy rows', () => {
    renderChart(baseHierarchicalProps(0));

    expect(getByText('▸ A')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('2026');
    expect(container).not.toHaveTextContent('Subtotal');

    ReactDOM.unmountComponentAtNode(container);
    renderChart(baseHierarchicalProps(1));

    expect(getByText('▾ A')).toBeInTheDocument();
    expect(getByText('2026')).toBeInTheDocument();
    expect(getByText('Subtotal')).toBeInTheDocument();
  });

  it('uses expandedRowPaths ownState before default expanded depth', () => {
    renderChart(baseHierarchicalProps(1, []));

    expect(getByText('▸ A')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('2026');
    expect(container).not.toHaveTextContent('Subtotal');
  });

  it('paginates generated columns while keeping row and total columns visible', () => {
    const generatedColumnIds = Array.from(
      { length: 101 },
      (_, index) => `__crosstab_col__number:${index + 1}__metric__amount`,
    );
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      rowData: [
        generatedColumnIds.reduce<Record<string, unknown>>(
          (row, columnId, index) => ({
            ...row,
            [columnId]: index + 1,
          }),
          {
            [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
            [CROSSTAB_ROW_LABEL]: 'A',
            [CROSSTAB_ROW_TYPE]: 'leaf',
            metric_name: 'A',
            __crosstab_total: 5151,
          },
        ),
      ],
      columns: [
        {
          key: 'metric_name',
          label: '指标项',
          dataType: GenericDataType.String,
        },
        ...generatedColumnIds.map(columnId => ({
          key: columnId,
          label: columnId,
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        })),
        {
          key: '__crosstab_total',
          label: 'Total',
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        },
      ],
      columnTree: generatedColumnIds.map((columnId, index) => ({
        id: `date-${index + 1}`,
        label: `D${index + 1}`,
        field: columnId,
        metric: 'amount',
      })),
      generatedColumnIds,
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('列 1-4 / 101')).toBeInTheDocument();
    expect(getPaginationFooter()).toHaveStyle({
      display: 'flex',
      flex: '0 0 auto',
      justifyContent: 'flex-end',
    });
    expect(
      container.querySelector('[data-test="crosstab-table-toolbar"]'),
    ).toHaveTextContent('CSV');
    expect(getByText('指标项')).toBeInTheDocument();
    expect(getByText('Total')).toBeInTheDocument();
    expect(getByText('D1')).toBeInTheDocument();
    expect(getByText('D4')).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/D5/);

    const nextButton = container.querySelector(
      'button[aria-label="Next crosstab columns"]',
    );
    if (!(nextButton instanceof HTMLButtonElement)) {
      throw new Error('Unable to find next columns button');
    }

    act(() => {
      nextButton.click();
    });

    expect(getByText('列 5-8 / 101')).toBeInTheDocument();
    expect(getByText('指标项')).toBeInTheDocument();
    expect(getByText('Total')).toBeInTheDocument();
    expect(getByText('D5')).toBeInTheDocument();
    expect(getByText('D8')).toBeInTheDocument();
    expect(() => getByText('D1')).toThrow('Unable to find text: D1');
  });

  it('updates own state for server column pagination instead of slicing local columns', () => {
    const setDataMask = jest.fn();
    const generatedColumnIds = Array.from(
      { length: 5 },
      (_, index) => `__crosstab_col__number:${index + 1}__metric__amount`,
    );
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        serverColumnPagination: true,
        columnPageSize: 98,
        generatedColumnWidth: 120,
      },
      hooks: {
        setDataMask,
      },
      ownState: {
        currentColumnPage: 0,
        serverColumnPageTuples: [['D1']],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
        currentColumnPageSize: 5,
      },
      serverColumnCurrentPage: 0,
      serverColumnPageSize: 5,
      serverColumnTotalCount: 4598,
      rowData: [
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
          [CROSSTAB_ROW_LABEL]: 'A',
          [CROSSTAB_ROW_TYPE]: 'leaf',
          metric_name: 'A',
        },
      ],
      columns: [
        {
          key: 'metric_name',
          label: '指标项',
          dataType: GenericDataType.String,
        },
        ...generatedColumnIds.map(columnId => ({
          key: columnId,
          label: columnId,
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        })),
      ],
      columnTree: generatedColumnIds.map((columnId, index) => ({
        id: `date-${index + 1}`,
        label: `D${index + 1}`,
        field: columnId,
        metric: 'amount',
      })),
      generatedColumnIds,
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('列 1-5 / 4598')).toBeInTheDocument();
    expect(getByText('D5')).toBeInTheDocument();

    const nextButton = container.querySelector(
      'button[aria-label="Next crosstab columns"]',
    );
    if (!(nextButton instanceof HTMLButtonElement)) {
      throw new Error('Unable to find next columns button');
    }

    act(() => {
      nextButton.click();
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        currentColumnPage: 1,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 1,
        serverColumnPageTuplesPageSize: 5,
      },
    });
  });

  it('computes the server column page size from chart width and generated column width', () => {
    const setDataMask = jest.fn();
    const generatedColumnIds = Array.from(
      { length: 5 },
      (_, index) => `__crosstab_col__number:${index + 1}__metric__amount`,
    );
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        serverColumnPagination: true,
        generatedColumnWidth: 120,
      },
      hooks: {
        setDataMask,
      },
      ownState: {
        currentColumnPage: 0,
      },
      serverColumnCurrentPage: 0,
      serverColumnTotalCount: 4598,
      rowData: [],
      columns: [
        {
          key: 'metric_name',
          label: '指标项',
          dataType: GenericDataType.String,
        },
        {
          key: 'total',
          label: 'Total',
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        },
        ...generatedColumnIds.map(columnId => ({
          key: columnId,
          label: columnId,
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        })),
      ],
      columnTree: generatedColumnIds.map((columnId, index) => ({
        id: `date-${index + 1}`,
        label: `D${index + 1}`,
        field: columnId,
        metric: 'amount',
      })),
      generatedColumnIds,
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('列 1-5 / 4598')).toBeInTheDocument();
    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
  });

  it('computes server column page size from the rendered grid viewport width', () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    );
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        const element = this as HTMLElement;

        if (element.classList.contains('ag-center-cols-viewport')) {
          return 1022;
        }

        return 0;
      },
    });

    try {
      const setDataMask = jest.fn();
      const generatedColumnIds = Array.from(
        { length: 100 },
        (_, index) => `__crosstab_col__number:${index + 1}__metric__amount`,
      );
      const props = {
        height: 400,
        width: 6000,
        formData: {
          datasource: '1__table',
          viz_type: 'crosstab_table',
          serverColumnPagination: true,
          generatedColumnWidth: 120,
        },
        hooks: {
          setDataMask,
        },
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 49,
          serverColumnPageTuples: [['D1']],
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 49,
        },
        serverColumnCurrentPage: 0,
        serverColumnPageSize: 49,
        serverColumnTotalCount: 4598,
        rowData: [],
        columns: [
          {
            key: 'metric_name',
            label: '指标项',
            dataType: GenericDataType.String,
          },
          {
            key: CROSSTAB_TOTAL_COLUMN_ID,
            label: 'Total',
            dataType: GenericDataType.Numeric,
            isMetric: true,
            isNumeric: true,
          },
          ...generatedColumnIds.map(columnId => ({
            key: columnId,
            label: columnId,
            dataType: GenericDataType.Numeric,
            isMetric: true,
            isNumeric: true,
          })),
        ],
        columnTree: generatedColumnIds.map((columnId, index) => ({
          id: `date-${index + 1}`,
          label: `D${index + 1}`,
          field: columnId,
          metric: 'amount',
        })),
        generatedColumnIds,
      } as unknown as CrosstabChartProps;

      renderChart(props);

      expect(setDataMask).toHaveBeenCalledWith({
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 8,
          serverColumnPageTuples: [],
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 8,
        },
      });
    } finally {
      if (clientWidthDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'clientWidth',
          clientWidthDescriptor,
        );
      } else {
        delete (HTMLElement.prototype as unknown as { clientWidth?: number })
          .clientWidth;
      }
    }
  });

  it('renders dynamic group-by select with configured label, options, and value', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      rowData: [],
      columns: [
        {
          key: 'metric_name',
          label: '指标项',
          dataType: GenericDataType.String,
        },
      ],
      columnTree: [],
      generatedColumnIds: [],
      selectedDynamicGroupByColumn: 'missing_dimension',
      dynamicGroupByConfig: {
        enabled: true,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'country',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: '国家', column: 'country' },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('分组维度')).toBeInTheDocument();

    const select = getDynamicGroupBySelect();
    expect(select).toHaveValue('country');
    expect(
      Array.from(select.options).map(option => ({
        label: option.textContent,
        value: option.value,
      })),
    ).toEqual([
      { label: '店铺', value: 'shop_name' },
      { label: '国家', value: 'country' },
    ]);
  });

  it('falls back to a valid dynamic group-by option for stale selected values', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
      selectedDynamicGroupByColumn: 'missing_dimension',
      dynamicGroupByConfig: {
        enabled: true,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'country',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: '国家', column: 'country' },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getDynamicGroupBySelect()).toHaveValue('country');
  });

  it('resets crosstab column cache when dynamic group-by selection changes', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        generatedColumnWidth: 120,
      },
      hooks: {
        setDataMask,
      },
      ownState: {
        currentColumnPage: 3,
        currentColumnPageSize: 3,
        effectiveGroupBySignature: 'rows=metric_name|columns=shop_name',
        expandedRowPaths: ['["A"]'],
        unrelatedOwnStateField: 'preserved',
        serverColumnPageColumnSignature: 'shop_name',
        serverColumnPageTuples: [['D1']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 3,
        serverColumnTotalCount: 100,
      },
      selectedDynamicGroupByColumn: 'shop_name',
      rowData: [],
      columns: [
        {
          key: 'metric_name',
          label: '指标项',
          dataType: GenericDataType.String,
        },
      ],
      columnTree: [],
      generatedColumnIds: [],
      dynamicGroupByConfig: {
        enabled: true,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'shop_name',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: '国家', column: 'country' },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = getDynamicGroupBySelect();
    act(() => {
      select.value = 'country';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupByColumn: 'country',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'expandedRowPaths',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageColumnSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnTotalCount',
    );
  });

  it('ignores invalid dynamic group-by change values', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      hooks: {
        setDataMask,
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
      selectedDynamicGroupByColumn: 'shop_name',
      dynamicGroupByConfig: {
        enabled: true,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'shop_name',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: '国家', column: 'country' },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    act(() => {
      getInvalidSelectChangeButton().click();
    });

    expect(setDataMask).not.toHaveBeenCalled();
  });

  it('does not render dynamic group-by select without an enabled config', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(
      container.querySelector(
        'select[aria-label="Select crosstab group by dimension"]',
      ),
    ).not.toBeInTheDocument();

    ReactDOM.unmountComponentAtNode(container);
    renderChart({
      ...props,
      dynamicGroupByConfig: {
        enabled: false,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'shop_name',
        options: [{ label: '店铺', column: 'shop_name' }],
      },
    } as unknown as CrosstabChartProps);

    expect(
      container.querySelector(
        'select[aria-label="Select crosstab group by dimension"]',
      ),
    ).not.toBeInTheDocument();
  });

  it('exports rendered CSV through the grid API', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
    } as unknown as CrosstabChartProps;

    renderChart(props);
    getExportButton().click();

    expect(mockExportDataAsCsv).toHaveBeenCalledWith({
      allColumns: false,
      skipColumnGroupHeaders: false,
    });
  });
});
