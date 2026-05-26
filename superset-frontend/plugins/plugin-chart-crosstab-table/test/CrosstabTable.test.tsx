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
import { GenericDataType } from '@apache-superset/core/common';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
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

let container: HTMLDivElement;
type TestColumnDef = ColDef & {
  children?: TestColumnDef[];
};

jest.mock('@apache-superset/core/theme', () => {
  const actual = jest.requireActual('@apache-superset/core/theme');

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
    disabled?: boolean;
    label?: string | number;
    value: string | number;
  };
  type MockSelectProps = {
    allowClear?: boolean;
    allowSelectAll?: boolean;
    ariaLabel?: string;
    onChange?: (value: string) => void;
    onClear?: () => void;
    options: MockSelectOption[];
    sortComparator?: () => number;
    value?: string | number | null;
  };
  type MockCellParams = {
    value: unknown;
    valueFormatted: unknown;
    rowIndex: number;
    data: Record<string, unknown>;
    colDef: ColDef;
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
                      const cellParams: MockCellParams = {
                        value,
                        valueFormatted: formatted,
                        rowIndex,
                        data: row,
                        colDef: columnDef,
                      };
                      const style =
                        typeof columnDef.cellStyle === 'function'
                          ? columnDef.cellStyle({
                              ...cellParams,
                              node: undefined,
                              column: undefined,
                              api: undefined,
                              context: undefined,
                            } as never)
                          : columnDef.cellStyle;
                      const cellClass =
                        typeof columnDef.cellClass === 'function'
                          ? columnDef.cellClass({
                              ...cellParams,
                              node: undefined,
                              column: undefined,
                              api: undefined,
                              context: undefined,
                            } as never)
                          : columnDef.cellClass;
                      const title =
                        typeof columnDef.tooltipValueGetter === 'function'
                          ? columnDef.tooltipValueGetter({
                              ...cellParams,
                              node: undefined,
                              column: undefined,
                              api: undefined,
                              context: undefined,
                              location: 'cell',
                            } as never)
                          : undefined;
                      const rendered =
                        typeof columnDef.cellRenderer === 'function'
                          ? columnDef.cellRenderer({
                              ...cellParams,
                              node: undefined,
                              column: undefined,
                              api: undefined,
                              context: undefined,
                            } as never)
                          : undefined;

                      return (
                        <td
                          className={cellClass as string | undefined}
                          key={columnDef.colId}
                          style={style as CSSProperties}
                          title={title as string | undefined}
                        >
                          {(rendered ?? formatted) as ReactNode}
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
      allowClear,
      allowSelectAll,
      ariaLabel,
      onChange,
      onClear,
      options,
      sortComparator,
      value,
    }: MockSelectProps) => (
      <>
        <select
          aria-label={ariaLabel}
          data-allow-select-all={allowSelectAll ? 'true' : 'false'}
          data-has-sort-comparator={sortComparator ? 'true' : 'false'}
          onChange={event => onChange?.(event.target.value)}
          value={value ?? ''}
        >
          {options.map(option => (
            <option
              disabled={option.disabled}
              key={String(option.value)}
              value={String(option.value)}
            >
              {option.label}
            </option>
          ))}
        </select>
        <button
          aria-label="Trigger invalid mock select change"
          onClick={() => onChange?.('__invalid_groupby_column__')}
          type="button"
        />
        {allowClear && (
          <button
            aria-label={`${ariaLabel} clear`}
            onClick={() => onClear?.()}
            type="button"
          />
        )}
      </>
    ),
    ThemedAgGridReact: MockAgGridReact,
  };
});

describe('CrosstabTable', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
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

  function getCellByText(text: string) {
    const cell = getByText(text).closest('td');
    if (!(cell instanceof HTMLTableCellElement)) {
      throw new Error(`Unable to find table cell for text: ${text}`);
    }
    return cell;
  }

  function getDynamicGroupBySelect(slotId: string) {
    const select = container.querySelector(
      `[data-test="crosstab-dynamic-groupby-control--${slotId}"] select`,
    );
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Unable to find dynamic group-by select');
    }
    return select;
  }

  function getDynamicGroupByClearButton(slotId: string) {
    const control = container.querySelector(
      `[data-test="crosstab-dynamic-groupby-control--${slotId}"]`,
    );
    const button = control?.querySelector('button[aria-label$=" clear"]');

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Unable to find dynamic group-by clear button');
    }

    return button;
  }

  function getSelectOption(select: HTMLSelectElement, value: string) {
    const option = Array.from(select.options).find(
      candidate => candidate.value === value,
    );
    if (!(option instanceof HTMLOptionElement)) {
      throw new Error(`Unable to find select option: ${value}`);
    }
    return option;
  }

  function getDynamicMetricSelect(slotId: string) {
    const select = container.querySelector(
      `[data-test="crosstab-dynamic-metric-control--${slotId}"] select`,
    );
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Unable to find dynamic metric select');
    }
    return select;
  }

  function getNumericParameterInput(name: string) {
    const input = container.querySelector(
      `[data-test="crosstab-parameter-control--${name}"] input`,
    );
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Unable to find numeric parameter input');
    }
    return input;
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

  function catchWindowErrors(callback: () => void) {
    const errors: Error[] = [];
    const handler = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };

    window.addEventListener('error', handler);
    try {
      callback();
    } catch (error) {
      errors.push(error as Error);
    } finally {
      window.removeEventListener('error', handler);
    }

    return errors;
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

  function baseFormatterProps(
    crosstabCellFormatterExpression: string,
    overrides: Partial<CrosstabChartProps> = {},
  ) {
    return {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        numberFormat: ',.1f',
        crosstabCellFormatterExpression,
      },
      rowData: [
        {
          [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
          [CROSSTAB_ROW_LABEL]: 'A',
          [CROSSTAB_ROW_TYPE]: 'leaf',
          contract_type: 'A',
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
          field: '__crosstab_col__string:4:Cash__metric__amount',
          metric: 'amount',
        },
      ],
      generatedColumnIds: ['__crosstab_col__string:4:Cash__metric__amount'],
      ...overrides,
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

    expect(getByText('↑ 12')).toHaveStyle(`
      color: rgb(0, 128, 0);
      background-color: rgb(255, 255, 255);
    `);
    expect(getByText('2')).toHaveStyle({
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
    });

    const subtotalRow = getByText('Subtotal').closest('tr');
    expect(subtotalRow).toBeInstanceOf(HTMLTableRowElement);
    expect(subtotalRow).toHaveStyle({
      backgroundColor: 'rgba(0, 0, 0, 0.06)',
      fontWeight: '600',
    });
  });

  it('uses formatter text for generated matrix value cells and exposes column metric', () => {
    renderChart(
      baseFormatterProps(
        `({ value, column }) => ({
          text: column.metric + ":" + value,
        })`,
      ),
    );

    expect(getByText('amount:1,234.6')).toBeInTheDocument();
    expect(() => getByText('1,234.6')).toThrow('Unable to find text: 1,234.6');
  });

  it('sanitizes formatter html before rendering generated matrix value cells', () => {
    renderChart(
      baseFormatterProps(
        `() => ({
          html: "<strong>Safe</strong><img src=x onerror='window.__unsafe = true'>",
        })`,
      ),
    );

    const cell = getCellByText('Safe');
    expect(cell.querySelector('strong')).toHaveTextContent('Safe');
    expect(cell.innerHTML).not.toContain('onerror');
  });

  it('applies formatter style, tooltip, and className to generated matrix value cells', () => {
    renderChart(
      baseFormatterProps(
        `({ rowIndex }) => ({
          text: "row-" + rowIndex,
          tooltip: "formatted tooltip",
          className: "formatter-highlight",
          style: {
            color: "rgb(10, 20, 30)",
            fontWeight: "700",
          },
        })`,
      ),
    );

    const cell = getCellByText('row-0');
    expect(cell).toHaveAttribute('title', 'formatted tooltip');
    expect(cell).toHaveClass('formatter-highlight');
    expect(cell).toHaveStyle({
      color: 'rgb(10, 20, 30)',
      fontWeight: '700',
    });
  });

  it('reuses one formatter result for generated cell rendering, style, class, and tooltip', () => {
    renderChart(
      baseFormatterProps(
        `(() => {
          let count = 0;

          return () => {
            count += 1;

            return {
              text: "value-" + count,
              tooltip: "tooltip-" + count,
              className: "formatter-count-" + count,
              style: {
                color: "rgb(10, 20, " + count + ")",
              },
            };
          };
        })()`,
      ),
    );

    const cell = getCellByText('value-1');
    expect(cell).toHaveAttribute('title', 'tooltip-1');
    expect(cell).toHaveClass('formatter-count-1');
    expect(cell).toHaveStyle({ color: 'rgb(10, 20, 1)' });
  });

  it('recomputes formatter output when the same row object moves to a different rowIndex', () => {
    const formData = {
      datasource: '1__table',
      viz_type: 'crosstab_table',
      numberFormat: ',.1f',
      crosstabCellFormatterExpression: `({ rowIndex }) => ({
        text: "row-" + rowIndex,
      })`,
    };
    const columns = [
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
    ];
    const columnTree = [
      {
        id: 'string:4:Cash',
        label: 'Cash',
        field: '__crosstab_col__string:4:Cash__metric__amount',
        metric: 'amount',
      },
    ];
    const targetRow = {
      [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
      [CROSSTAB_ROW_LABEL]: 'A',
      [CROSSTAB_ROW_TYPE]: 'leaf',
      contract_type: 'A',
      '__crosstab_col__string:4:Cash__metric__amount': 1234.56,
    };
    const leadingRow = {
      [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['B']),
      [CROSSTAB_ROW_LABEL]: 'B',
      [CROSSTAB_ROW_TYPE]: 'leaf',
      contract_type: 'B',
      '__crosstab_col__string:4:Cash__metric__amount': 1234.56,
    };
    const baseProps = {
      height: 400,
      width: 800,
      formData,
      columns,
      columnTree,
      generatedColumnIds: ['__crosstab_col__string:4:Cash__metric__amount'],
    } as unknown as CrosstabChartProps;

    renderChart({
      ...baseProps,
      rowData: [targetRow],
    } as CrosstabChartProps);
    expect(getByText('row-0')).toBeInTheDocument();

    renderChart({
      ...baseProps,
      rowData: [leadingRow, targetRow],
    } as CrosstabChartProps);

    expect(getByText('row-1')).toBeInTheDocument();
  });

  it('keeps default display, conditional formatting, and arrows when formatter returns undefined or null', () => {
    renderChart(
      baseFormatterProps(
        `({ rowIndex }) => (rowIndex === 0 ? undefined : null)`,
        {
          formData: {
            datasource: '1__table',
            viz_type: 'crosstab_table',
            numberFormat: ',.1f',
            crosstabCellFormatterExpression: `({ rowIndex }) => (
              rowIndex === 0 ? undefined : null
            )`,
            conditionalFormatting: [
              {
                metric: 'amount',
                operator: '>=',
                value: 1000,
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
              '__crosstab_col__string:4:Cash__metric__amount': 1234.56,
            },
            {
              [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['B']),
              [CROSSTAB_ROW_LABEL]: 'B',
              [CROSSTAB_ROW_TYPE]: 'leaf',
              contract_type: 'B',
              '__crosstab_col__string:4:Cash__metric__amount': 2345.67,
            },
          ],
        },
      ),
    );

    expect(getCellByText('↑ 1,234.6')).toHaveStyle(`
      color: rgb(0, 128, 0);
      background-color: rgb(255, 255, 255);
    `);
    expect(getCellByText('↑ 2,345.7')).toHaveStyle(`
      color: rgb(0, 128, 0);
      background-color: rgb(255, 255, 255);
    `);
  });

  it('lets formatter style override conditional formatting colors', () => {
    renderChart(
      baseFormatterProps(
        `() => ({
          text: "styled",
          style: {
            color: "purple",
            backgroundColor: "yellow",
          },
        })`,
        {
          formData: {
            datasource: '1__table',
            viz_type: 'crosstab_table',
            numberFormat: ',.1f',
            crosstabCellFormatterExpression: `() => ({
              text: "styled",
              style: {
                color: "purple",
                backgroundColor: "yellow",
              },
            })`,
            conditionalFormatting: [
              {
                metric: 'amount',
                operator: '>=',
                value: 1000,
                color: 'green',
                backgroundColor: 'white',
              },
            ],
          },
        },
      ),
    );

    expect(getCellByText('styled')).toHaveStyle(`
      color: rgb(128, 0, 128);
      background-color: rgb(255, 255, 0);
    `);
  });

  it('does not apply the cell formatter to row dimension cells', () => {
    renderChart(
      baseFormatterProps(
        `() => ({
          text: "formatted",
        })`,
      ),
    );

    expect(getByText('A')).toBeInTheDocument();
    expect(getByText('formatted')).toBeInTheDocument();
    expect(container.querySelectorAll('td')).toHaveLength(2);
  });

  it('does not apply the cell formatter to the total column', () => {
    renderChart(
      baseFormatterProps(`() => ({ text: "formatted" })`, {
        rowData: [
          {
            [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
            [CROSSTAB_ROW_LABEL]: 'A',
            [CROSSTAB_ROW_TYPE]: 'leaf',
            contract_type: 'A',
            '__crosstab_col__string:4:Cash__metric__amount': 1234.56,
            [CROSSTAB_TOTAL_COLUMN_ID]: 9999,
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
          {
            key: CROSSTAB_TOTAL_COLUMN_ID,
            label: 'Total',
            dataType: GenericDataType.Numeric,
            isMetric: true,
            isNumeric: true,
          },
        ],
      }),
    );

    expect(getByText('formatted')).toBeInTheDocument();
    expect(getByText('9,999.0')).toBeInTheDocument();
    expect(container.querySelectorAll('td')).toHaveLength(3);
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
    const setDataMask = jest.fn();
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
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: '调整系数',
            defaultValue: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
      },
      hooks: {
        setDataMask,
      },
      numericParameters: { param_adjustment: 1 },
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

    expect(getByText('Columns 1-4 / 101')).toBeInTheDocument();
    expect(getPaginationFooter()).toHaveStyle({
      display: 'flex',
      flex: '0 0 auto',
      justifyContent: 'flex-end',
    });
    expect(
      container.querySelector('[data-test="crosstab-table-toolbar"]'),
    ).not.toHaveTextContent('CSV');
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

    expect(getByText('Columns 5-8 / 101')).toBeInTheDocument();
    expect(getByText('指标项')).toBeInTheDocument();
    expect(getByText('Total')).toBeInTheDocument();
    expect(getByText('D5')).toBeInTheDocument();
    expect(getByText('D8')).toBeInTheDocument();
    expect(() => getByText('D1')).toThrow('Unable to find text: D1');

    const input = getNumericParameterInput('param_adjustment');
    act(() => {
      Simulate.change(input, { target: { value: '1.25' } } as never);
    });

    expect(getByText('Columns 1-4 / 101')).toBeInTheDocument();
    expect(getByText('D1')).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/D5/);
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

    expect(getByText('Columns 1-5 / 4598')).toBeInTheDocument();
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

    expect(getByText('Columns 1-5 / 4598')).toBeInTheDocument();
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
        slots: [
          {
            id: '__legacy__',
            label: '分组维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'country',
            options: [
              { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('分组维度')).toBeInTheDocument();

    const select = getDynamicGroupBySelect('__legacy__');
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
        slots: [
          {
            id: '__legacy__',
            label: '分组维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'country',
            options: [
              { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getDynamicGroupBySelect('__legacy__')).toHaveValue('country');
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
        slots: [
          {
            id: '__legacy__',
            label: '分组维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop_name',
            options: [
              { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = getDynamicGroupBySelect('__legacy__');
    act(() => {
      select.value = 'country';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: { __legacy__: 'country' },
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
      'selectedDynamicGroupByColumn',
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
        slots: [
          {
            id: '__legacy__',
            label: '分组维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop_name',
            options: [
              { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    act(() => {
      getInvalidSelectChangeButton().click();
    });

    expect(setDataMask).not.toHaveBeenCalled();
  });

  it('renders one dynamic group-by selector per normalized slot', () => {
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
      selectedDynamicGroupBy: { level2: 'country', level3: 'msku' },
      dynamicGroupByConfig: {
        enabled: true,
        slots: [
          {
            id: 'level2',
            label: '二级维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop',
            options: [
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
          {
            id: 'level3',
            label: '三级维度',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'none',
            options: [
              { id: 'none', label: '(无)', columns: [] },
              { id: 'msku', label: 'MSKU', columns: ['msku'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('二级维度')).toBeInTheDocument();
    expect(getByText('三级维度')).toBeInTheDocument();
    expect(getDynamicGroupBySelect('level2')).toHaveValue('country');
    expect(getDynamicGroupBySelect('level3')).toHaveValue('msku');
  });

  it('updates one slot while preserving other selected slots', () => {
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
        selectedDynamicGroupBy: { level2: 'shop', level3: 'none' },
        selectedDynamicGroupByColumn: 'shop_name',
        serverColumnPageColumnSignature: 'shop_name',
        serverColumnPageTuples: [['D1']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 3,
        serverColumnTotalCount: 100,
      },
      selectedDynamicGroupBy: { level2: 'shop', level3: 'none' },
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
        slots: [
          {
            id: 'level2',
            label: '二级维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop',
            options: [
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
          {
            id: 'level3',
            label: '三级维度',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'none',
            options: [
              { id: 'none', label: '(无)', columns: [] },
              { id: 'msku', label: 'MSKU', columns: ['msku'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = getDynamicGroupBySelect('level3');
    act(() => {
      select.value = 'msku';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: { level2: 'shop', level3: 'msku' },
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
      'selectedDynamicGroupByColumn',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageColumnSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnTotalCount',
    );
  });

  it('makes selected dynamic group-by values mutually exclusive across slots', () => {
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
      ownState: {
        selectedDynamicGroupBy: {
          dimension1: 'date',
          dimension2: 'shop',
          dimension3: 'country',
        },
      },
      selectedDynamicGroupBy: {
        dimension1: 'date',
        dimension2: 'shop',
        dimension3: 'country',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
      dynamicGroupByConfig: {
        enabled: true,
        slots: [
          {
            id: 'dimension1',
            label: '维度1',
            placement: 'columns',
            slotIndex: 0,
            spliceCount: 1,
            defaultOptionId: 'date',
            options: [
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
              { id: 'none', label: '无', columns: [] },
              { id: 'msku', label: 'MSKU', columns: ['msku'] },
            ],
          },
          {
            id: 'dimension2',
            label: '维度2',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop',
            options: [
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
              { id: 'none', label: '无', columns: [] },
              { id: 'msku', label: 'MSKU', columns: ['msku'] },
            ],
          },
          {
            id: 'dimension3',
            label: '维度3',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'country',
            options: [
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
              { id: 'none', label: '无', columns: [] },
              { id: 'msku', label: 'MSKU', columns: ['msku'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const firstSelect = getDynamicGroupBySelect('dimension1');
    expect(getSelectOption(firstSelect, 'date').disabled).toBe(false);
    expect(getSelectOption(firstSelect, 'shop').disabled).toBe(true);
    expect(getSelectOption(firstSelect, 'country').disabled).toBe(true);
    expect(getSelectOption(firstSelect, 'none').disabled).toBe(false);
    expect(getSelectOption(firstSelect, 'msku').disabled).toBe(false);

    const secondSelect = getDynamicGroupBySelect('dimension2');
    expect(secondSelect.dataset.hasSortComparator).toBe('true');
    expect(getSelectOption(secondSelect, 'date').disabled).toBe(true);
    expect(getSelectOption(secondSelect, 'shop').disabled).toBe(false);
    expect(getSelectOption(secondSelect, 'country').disabled).toBe(true);
    expect(getSelectOption(secondSelect, 'none').disabled).toBe(false);
    expect(getSelectOption(secondSelect, 'msku').disabled).toBe(false);

    act(() => {
      getDynamicGroupBySelect('dimension2').value = 'date';
      getDynamicGroupBySelect('dimension2').dispatchEvent(
        new Event('change', { bubbles: true }),
      );
    });

    expect(setDataMask).not.toHaveBeenCalled();
  });

  it('clears a dynamic group-by slot to its empty option', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        generatedColumnWidth: 120,
        viz_type: 'crosstab_table',
      },
      hooks: {
        setDataMask,
      },
      ownState: {
        selectedDynamicGroupBy: {
          dimension1: 'date',
          dimension2: 'shop',
          dimension3: 'country',
        },
      },
      selectedDynamicGroupBy: {
        dimension1: 'date',
        dimension2: 'shop',
        dimension3: 'country',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
      dynamicGroupByConfig: {
        enabled: true,
        slots: [
          {
            id: 'dimension1',
            label: '维度1',
            placement: 'columns',
            slotIndex: 0,
            spliceCount: 1,
            defaultOptionId: 'date',
            options: [
              { id: 'none', label: '无', columns: [] },
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
          {
            id: 'dimension2',
            label: '维度2',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop',
            options: [
              { id: 'none', label: '无', columns: [] },
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
          {
            id: 'dimension3',
            label: '维度3',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'country',
            options: [
              { id: 'none', label: '无', columns: [] },
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    act(() => {
      getDynamicGroupByClearButton('dimension2').click();
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        selectedDynamicGroupBy: {
          dimension1: 'date',
          dimension2: 'none',
          dimension3: 'country',
        },
        currentColumnPage: 0,
        currentColumnPageSize: 7,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 7,
      },
    });
  });

  it('prevents clearing the last active dynamic group-by slot for a placement', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        generatedColumnWidth: 120,
        viz_type: 'crosstab_table',
      },
      hooks: {
        setDataMask,
      },
      ownState: {
        selectedDynamicGroupBy: {
          dimension1: 'date',
          dimension2: 'none',
          dimension3: 'none',
        },
      },
      selectedDynamicGroupBy: {
        dimension1: 'date',
        dimension2: 'none',
        dimension3: 'none',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
      dynamicGroupByConfig: {
        enabled: true,
        slots: [
          {
            id: 'dimension1',
            label: '维度1',
            placement: 'columns',
            slotIndex: 0,
            spliceCount: 1,
            defaultOptionId: 'date',
            options: [
              { id: 'none', label: '无', columns: [] },
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
            ],
          },
          {
            id: 'dimension2',
            label: '维度2',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'none',
            options: [
              { id: 'none', label: '无', columns: [] },
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
            ],
          },
          {
            id: 'dimension3',
            label: '维度3',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'none',
            options: [
              { id: 'none', label: '无', columns: [] },
              { id: 'date', label: '日期', columns: ['biz_date'] },
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const firstSelect = getDynamicGroupBySelect('dimension1');
    expect(getSelectOption(firstSelect, 'none').disabled).toBe(true);
    expect(() => getDynamicGroupByClearButton('dimension1')).toThrow(
      'Unable to find dynamic group-by clear button',
    );

    act(() => {
      firstSelect.value = 'none';
      firstSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).not.toHaveBeenCalled();
  });

  it('renders a numeric parameter control and writes own-state on change', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        generatedColumnWidth: 120,
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: '调整系数',
            defaultValue: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
      },
      hooks: {
        setDataMask,
      },
      numericParameters: { param_adjustment: 1 },
      ownState: {
        currentColumnPage: 2,
        currentColumnPageSize: 8,
        effectiveMetricSignature: 'stale-metric-signature',
        expandedRowPaths: ['category::A'],
        serverColumnPageColumnSignature: 'stale-column-signature',
        serverColumnPageTuples: [['stale']],
        serverColumnPageTuplesPage: 2,
        serverColumnPageTuplesPageSize: 8,
        serverColumnTotalCount: 100,
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
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const input = getNumericParameterInput('param_adjustment');
    expect(input).toHaveAccessibleName('调整系数');
    expect(input).toHaveValue(1);

    act(() => {
      Simulate.change(input, { target: { value: '1.25' } } as never);
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: expect.objectContaining({
        numericParameters: { param_adjustment: 1.25 },
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        expandedRowPaths: ['category::A'],
      }),
    });
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'effectiveMetricSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageColumnSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnTotalCount',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuples',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuplesPage',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuplesPageSize',
    );
  });

  it('renders numeric runtime parameters from canonical config', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
      },
      numericParameters: { param_adjustment: 1 },
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
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const numberInput = getNumericParameterInput('param_adjustment');

    expect(numberInput).toHaveAccessibleName('Adjustment');
    expect(numberInput).toHaveValue(1);
  });

  it('writes runtime numeric parameter own-state and resets column pagination', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        generatedColumnWidth: 120,
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
      },
      hooks: {
        setDataMask,
      },
      numericParameters: { param_adjustment: 1 },
      ownState: {
        unrelatedOwnStateField: 'preserved',
        currentColumnPage: 2,
        currentColumnPageSize: 8,
        effectiveMetricSignature: 'stale-metric-signature',
        expandedRowPaths: ['category::A'],
        serverColumnPageColumnSignature: 'stale-column-signature',
        serverColumnPageTuples: [['stale']],
        serverColumnPageTuplesPage: 2,
        serverColumnPageTuplesPageSize: 8,
        serverColumnTotalCount: 100,
        numericParameters: { param_adjustment: 1 },
        textParameters: { stale_country: 'DE' },
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
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const input = getNumericParameterInput('param_adjustment');

    act(() => {
      Simulate.change(input, { target: { value: '1.25' } } as never);
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: expect.objectContaining({
        unrelatedOwnStateField: 'preserved',
        expandedRowPaths: ['category::A'],
        numericParameters: { param_adjustment: 1.25 },
        currentColumnPage: 0,
        currentColumnPageSize: 5,
      }),
    });
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'effectiveMetricSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageColumnSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnTotalCount',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuples',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuplesPage',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuplesPageSize',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'textParameters',
    );
  });

  it('rejects invalid numeric parameter max and step values before writing own-state', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        generatedColumnWidth: 120,
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: '调整系数',
            defaultValue: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
      },
      hooks: {
        setDataMask,
      },
      numericParameters: { param_adjustment: 1 },
      ownState: {
        expandedRowPaths: ['category::A'],
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
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const input = getNumericParameterInput('param_adjustment');

    const maxErrors = catchWindowErrors(() => {
      act(() => {
        Simulate.change(input, { target: { value: '2.5' } } as never);
      });
    });
    const stepErrors = catchWindowErrors(() => {
      act(() => {
        Simulate.change(input, { target: { value: '1.255' } } as never);
      });
    });

    expect([...maxErrors, ...stepErrors]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Crosstab numeric parameter value is invalid.',
        }),
        expect.objectContaining({
          message: 'Crosstab numeric parameter value is invalid.',
        }),
      ]),
    );
    expect(setDataMask).not.toHaveBeenCalled();
  });

  it('renders one dynamic metric selector per configured slot', () => {
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
      dynamicMetricConfig: {
        enabled: true,
        slots: [
          {
            id: 'primary',
            label: '主指标',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'sales',
            options: [
              { id: 'sales', label: '销售额', metrics: [{ metric: 'sales' }] },
              { id: 'profit', label: '利润', metrics: [{ metric: 'profit' }] },
            ],
          },
          {
            id: 'secondary',
            label: '辅指标',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'margin',
            options: [
              { id: 'margin', label: '毛利', metrics: [{ metric: 'margin' }] },
              {
                id: 'profit_rate',
                label: '利润率',
                metrics: [{ metric: 'profit_rate' }],
              },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('主指标')).toBeInTheDocument();
    expect(getByText('辅指标')).toBeInTheDocument();
    expect(getDynamicMetricSelect('primary')).toHaveValue('sales');
    expect(getDynamicMetricSelect('secondary')).toHaveValue('margin');
  });

  it('uses selected dynamic metric values with per-slot default fallback', () => {
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
      selectedDynamicMetric: {
        primary: 'profit',
        secondary: 'stale_option',
      },
      dynamicMetricConfig: {
        enabled: true,
        slots: [
          {
            id: 'primary',
            label: '主指标',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'sales',
            options: [
              { id: 'sales', label: '销售额', metrics: [{ metric: 'sales' }] },
              { id: 'profit', label: '利润', metrics: [{ metric: 'profit' }] },
            ],
          },
          {
            id: 'secondary',
            label: '辅指标',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'margin',
            options: [
              { id: 'margin', label: '毛利', metrics: [{ metric: 'margin' }] },
              {
                id: 'profit_rate',
                label: '利润率',
                metrics: [{ metric: 'profit_rate' }],
              },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getDynamicMetricSelect('primary')).toHaveValue('profit');
    expect(getDynamicMetricSelect('secondary')).toHaveValue('margin');
  });

  it('updates one dynamic metric slot while preserving other selected metric entries', () => {
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
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: { level2: 'shop' },
      },
      selectedDynamicMetric: {
        primary: 'sales',
        secondary: 'margin',
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
      dynamicMetricConfig: {
        enabled: true,
        slots: [
          {
            id: 'primary',
            label: '主指标',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'sales',
            options: [
              { id: 'sales', label: '销售额', metrics: [{ metric: 'sales' }] },
              { id: 'profit', label: '利润', metrics: [{ metric: 'profit' }] },
            ],
          },
          {
            id: 'secondary',
            label: '辅指标',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'margin',
            options: [
              { id: 'margin', label: '毛利', metrics: [{ metric: 'margin' }] },
              {
                id: 'profit_rate',
                label: '利润率',
                metrics: [{ metric: 'profit_rate' }],
              },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = getDynamicMetricSelect('secondary');
    act(() => {
      select.value = 'profit_rate';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: { level2: 'shop' },
        selectedDynamicMetric: {
          primary: 'sales',
          secondary: 'profit_rate',
        },
        currentColumnPage: 0,
        currentColumnPageSize: 5,
      },
    });
  });

  it('preserves expanded row paths when a dynamic metric changes', () => {
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
        expandedRowPaths: ['["A"]'],
      },
      selectedDynamicMetric: {
        primary: 'sales',
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
      dynamicMetricConfig: {
        enabled: true,
        slots: [
          {
            id: 'primary',
            label: '主指标',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'sales',
            options: [
              { id: 'sales', label: '销售额', metrics: [{ metric: 'sales' }] },
              { id: 'profit', label: '利润', metrics: [{ metric: 'profit' }] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = getDynamicMetricSelect('primary');
    act(() => {
      select.value = 'profit';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask.mock.calls[0][0].ownState).toMatchObject({
      expandedRowPaths: ['["A"]'],
      selectedDynamicMetric: { primary: 'profit' },
    });
  });

  it('removes stale server-column cache keys when a dynamic metric changes', () => {
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
        effectiveMetricSignature: 'sales',
        expandedRowPaths: ['["A"]'],
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: { level2: 'shop' },
        selectedDynamicMetric: { primary: 'sales' },
        serverColumnPageColumnSignature: 'shop_name',
        serverColumnPageTuples: [['D1']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 3,
        serverColumnTotalCount: 100,
      },
      selectedDynamicMetric: {
        primary: 'sales',
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
      dynamicMetricConfig: {
        enabled: true,
        slots: [
          {
            id: 'primary',
            label: '主指标',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'sales',
            options: [
              { id: 'sales', label: '销售额', metrics: [{ metric: 'sales' }] },
              { id: 'profit', label: '利润', metrics: [{ metric: 'profit' }] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = getDynamicMetricSelect('primary');
    act(() => {
      select.value = 'profit';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        expandedRowPaths: ['["A"]'],
        selectedDynamicGroupBy: { level2: 'shop' },
        selectedDynamicMetric: { primary: 'profit' },
        unrelatedOwnStateField: 'preserved',
      },
    });
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'effectiveMetricSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageColumnSignature',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuples',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuplesPage',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnPageTuplesPageSize',
    );
    expect(setDataMask.mock.calls[0][0].ownState).not.toHaveProperty(
      'serverColumnTotalCount',
    );
  });

  it('ignores invalid dynamic metric selected values and option changes', () => {
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
      selectedDynamicMetric: {
        primary: 'stale_metric',
      },
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
      dynamicMetricConfig: {
        enabled: true,
        slots: [
          {
            id: 'primary',
            label: '主指标',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'sales',
            options: [
              { id: 'sales', label: '销售额', metrics: [{ metric: 'sales' }] },
              { id: 'profit', label: '利润', metrics: [{ metric: 'profit' }] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getDynamicMetricSelect('primary')).toHaveValue('sales');
    expect(setDataMask).not.toHaveBeenCalled();

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
});
