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
import { GenericDataType } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import type { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import CrosstabTable from '../src/CrosstabTable';
import type { CrosstabChartProps } from '../src/types';

jest.mock('@superset-ui/core/components', () => {
  return {
    ThemedAgGridReact: ({
      columnDefs,
      rowData,
    }: {
      columnDefs: ColDef[];
      rowData: Record<string, unknown>[];
    }) => (
      <table>
        <tbody>
          {rowData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columnDefs.map(columnDef => {
                const value = row[columnDef.field ?? ''];
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
          ))}
        </tbody>
      </table>
    ),
  };
});

describe('CrosstabTable', () => {
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
      columnTree: [],
      generatedColumnIds: ['__crosstab_col__string:4:Cash__metric__amount'],
    } as unknown as CrosstabChartProps;

    render(<CrosstabTable {...props} />);

    expect(screen.getByTestId('crosstab-table')).toHaveStyle({
      height: '400px',
      width: '800px',
    });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('1,234.6')).toBeInTheDocument();
  });

  it('renders conditional arrows and clears stale conditional style keys', () => {
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
          '__crosstab_col__string:4:Cash__metric__amount': 12,
        },
        {
          '__crosstab_col__string:4:Cash__metric__amount': 2,
        },
      ],
      columns: [
        {
          key: '__crosstab_col__string:4:Cash__metric__amount',
          label: 'Cash amount',
          dataType: GenericDataType.Numeric,
          isMetric: true,
          isNumeric: true,
        },
      ],
      columnTree: [],
      generatedColumnIds: ['__crosstab_col__string:4:Cash__metric__amount'],
    } as unknown as CrosstabChartProps;

    render(<CrosstabTable {...props} />);

    expect(screen.getByText('↑ 12')).toHaveStyle({
      color: 'green',
      backgroundColor: 'white',
    });
    expect(screen.getByText('2')).toHaveStyle({
      color: '',
      backgroundColor: '',
    });
  });
});
