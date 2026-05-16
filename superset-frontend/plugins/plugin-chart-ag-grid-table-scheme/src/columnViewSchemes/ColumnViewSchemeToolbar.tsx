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
import { styled, t } from '@superset-ui/core';
import { Button, Input, Modal, Select, Space } from 'antd';
import type {
  ColDef,
  GridReadyEvent,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { useColumnViewSchemes } from './useColumnViewSchemes';

const Toolbar = styled.div`
  ${({ theme }) => `
    align-items: center;
    background: ${theme.colorBgBase};
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    height: 48px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
  `}
`;

const SchemeSelect = styled(Select<number | null>)`
  min-width: 220px;
`;

type GridApi = GridReadyEvent['api'];

type ColumnViewSchemeToolbarProps = {
  chartId: number;
  dashboardId?: number | null;
  datasetId?: number | null;
  gridApi?: GridApi;
  colDefs: ColDef[];
  includeSortState?: boolean;
};

export default function ColumnViewSchemeToolbar({
  chartId,
  dashboardId,
  datasetId,
  gridApi,
  colDefs,
  includeSortState,
}: ColumnViewSchemeToolbarProps) {
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [newSchemeName, setNewSchemeName] = useState('');
  const {
    activeScheme,
    deleteActiveScheme,
    deleting,
    loading,
    resetColumns,
    saveActiveScheme,
    saveAsScheme,
    saving,
    schemes,
    setActiveAsDefault,
    switchScheme,
  } = useColumnViewSchemes({
    chartId,
    dashboardId,
    datasetId,
    gridApi,
    colDefs,
    includeSortState,
  });

  const closeSaveAsModal = () => {
    setIsSaveAsOpen(false);
    setNewSchemeName('');
  };

  const handleSaveAs = async () => {
    try {
      await saveAsScheme(newSchemeName.trim());
      closeSaveAsModal();
    } catch {
      // The hook already reports the save failure to the user.
    }
  };

  const isBusy = loading || saving || deleting;
  const isGridReady = Boolean(gridApi);
  const hasActiveScheme = activeScheme !== null;
  const trimmedSchemeName = newSchemeName.trim();

  return (
    <Toolbar>
      <SchemeSelect
        allowClear
        disabled={isBusy}
        loading={loading}
        onChange={(value: number | null) => switchScheme(value ?? null)}
        options={schemes.map(scheme => ({
          label: scheme.is_default
            ? `${scheme.name} (${t('default')})`
            : scheme.name,
          value: scheme.id,
        }))}
        placeholder={t('Column view')}
        value={activeScheme?.id}
      />
      <Space size="small">
        <Button
          disabled={!hasActiveScheme || isBusy || !isGridReady}
          loading={saving}
          onClick={saveActiveScheme}
        >
          {t('Save')}
        </Button>
        <Button
          disabled={isBusy || !isGridReady}
          onClick={() => setIsSaveAsOpen(true)}
        >
          {t('Save as')}
        </Button>
        <Button
          disabled={!hasActiveScheme || activeScheme?.is_default || isBusy}
          loading={saving}
          onClick={setActiveAsDefault}
        >
          {t('Set default')}
        </Button>
        <Button disabled={isBusy || !isGridReady} onClick={resetColumns}>
          {t('Reset')}
        </Button>
        {hasActiveScheme && (
          <Button
            danger
            disabled={isBusy}
            loading={deleting}
            onClick={deleteActiveScheme}
          >
            {t('Delete')}
          </Button>
        )}
      </Space>
      <Modal
        destroyOnClose
        okButtonProps={{ disabled: !trimmedSchemeName, loading: saving }}
        onCancel={closeSaveAsModal}
        onOk={handleSaveAs}
        open={isSaveAsOpen}
        title={t('Save column view')}
      >
        <Input
          autoFocus
          maxLength={128}
          onChange={event => setNewSchemeName(event.target.value)}
          onPressEnter={() => {
            if (trimmedSchemeName) {
              handleSaveAs();
            }
          }}
          placeholder={t('Scheme name')}
          value={newSchemeName}
        />
      </Modal>
    </Toolbar>
  );
}
