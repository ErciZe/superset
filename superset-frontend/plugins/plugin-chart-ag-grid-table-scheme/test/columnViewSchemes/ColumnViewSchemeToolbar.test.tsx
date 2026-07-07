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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import ColumnViewSchemeToolbar from '../../src/columnViewSchemes/ColumnViewSchemeToolbar';
import { useColumnViewSchemes } from '../../src/columnViewSchemes/useColumnViewSchemes';

jest.mock('../../src/columnViewSchemes/useColumnViewSchemes', () => ({
  useColumnViewSchemes: jest.fn(),
}));

const mockUseColumnViewSchemes = useColumnViewSchemes as jest.Mock;

const renderToolbar = () =>
  render(
    <ColumnViewSchemeToolbar
      chartId={1}
      colDefs={[]}
      columnSettingsEnabled
      gridApi={{} as never}
      schemeManagementEnabled
    />,
  );

describe('ColumnViewSchemeToolbar', () => {
  const deleteActiveScheme = jest.fn();

  beforeEach(() => {
    deleteActiveScheme.mockReset();
    mockUseColumnViewSchemes.mockReturnValue({
      activeScheme: { id: 1, is_default: true, name: '日常方案' },
      applyColumnSettings: jest.fn(),
      deleteActiveScheme,
      deleting: false,
      getDefaultColumnSettings: jest.fn(() => []),
      getColumnSettings: jest.fn(() => []),
      loading: false,
      resetColumns: jest.fn(),
      saveActiveScheme: jest.fn(),
      saveAsScheme: jest.fn(),
      saving: false,
      schemes: [{ id: 1, is_default: true, name: '日常方案' }],
      setActiveAsDefault: jest.fn(),
      switchScheme: jest.fn(),
    });
  });

  test('uses Chinese text for scheme toolbar actions', () => {
    renderToolbar();

    expect(screen.getByText(/保\s*存/)).toBeInTheDocument();
    expect(screen.getByText('另存为')).toBeInTheDocument();
    expect(screen.getByText(/重\s*置/)).toBeInTheDocument();
    expect(screen.getByText(/删\s*除/)).toBeInTheDocument();
  });

  test('requires confirmation before deleting the active scheme', () => {
    renderToolbar();

    userEvent.click(screen.getByRole('button', { name: /删\s*除/ }));

    expect(deleteActiveScheme).not.toHaveBeenCalled();
    expect(
      screen.getByText('确认删除列配置方案“日常方案”？'),
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
    expect(deleteActiveScheme).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button', { name: /删\s*除/ }));
    userEvent.click(screen.getByRole('button', { name: /确\s*定/ }));
    expect(deleteActiveScheme).toHaveBeenCalledTimes(1);
  });

  test('warns when deleting the default scheme', () => {
    renderToolbar();

    userEvent.click(screen.getByRole('button', { name: /删\s*除/ }));

    expect(
      screen.getByText('该方案是默认方案，删除后将取消当前默认方案。'),
    ).toBeInTheDocument();
  });
});
