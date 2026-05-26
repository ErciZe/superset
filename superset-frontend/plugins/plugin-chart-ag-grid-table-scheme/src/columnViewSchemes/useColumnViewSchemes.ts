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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { message } from 'antd';
import type {
  ColDef,
  GridReadyEvent,
} from '@superset-ui/core/components/ThemedAgGridReact';
import {
  buildColumnSettingItems,
  buildColumnStateFromSettings,
  buildDefaultColumnSettingItems,
  captureColumnViewState,
  reconcileColumnState,
} from './state';
import type {
  ColumnSettingItem,
  ColumnViewColumnState,
  ColumnViewScheme,
  SchemeColDef,
} from './types';
import {
  createScheme,
  deleteScheme,
  fetchDefaultScheme,
  fetchSchemes,
  setDefaultScheme,
  updateScheme,
  type ColumnViewSchemeScope,
} from './api';

type GridApi = GridReadyEvent['api'];
type ApplyColumnState = Parameters<GridApi['applyColumnState']>[0];

type UseColumnViewSchemesArgs = ColumnViewSchemeScope & {
  colDefs: ColDef[];
  gridApi?: GridApi;
  includeSortState?: boolean;
};

const upsertScheme = (
  schemes: ColumnViewScheme[],
  updatedScheme: ColumnViewScheme,
) => {
  const existingIndex = schemes.findIndex(
    scheme => scheme.id === updatedScheme.id,
  );
  if (existingIndex === -1) {
    return [updatedScheme, ...schemes];
  }
  return schemes.map(scheme =>
    scheme.id === updatedScheme.id ? updatedScheme : scheme,
  );
};

export const useColumnViewSchemes = ({
  chartId,
  dashboardId,
  datasetId,
  colDefs,
  gridApi,
  includeSortState = true,
}: UseColumnViewSchemesArgs) => {
  const [schemes, setSchemes] = useState<ColumnViewScheme[]>([]);
  const [activeScheme, setActiveScheme] = useState<ColumnViewScheme | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scope = useMemo(
    () => ({ chartId, dashboardId, datasetId }),
    [chartId, dashboardId, datasetId],
  );

  const applyScheme = useCallback(
    (scheme: ColumnViewScheme) => {
      if (!gridApi) {
        return;
      }
      gridApi.applyColumnState({
        state: reconcileColumnState(scheme.state, colDefs as SchemeColDef[], {
          includeSort: includeSortState,
        }) as ApplyColumnState['state'],
        applyOrder: true,
      });
    },
    [colDefs, gridApi, includeSortState],
  );

  useEffect(() => {
    if (!gridApi) {
      return undefined;
    }

    let isMounted = true;
    setLoading(true);
    Promise.all([fetchSchemes(scope), fetchDefaultScheme(scope)])
      .then(([schemeList, defaultScheme]) => {
        if (!isMounted) {
          return;
        }
        setSchemes(schemeList);
        setActiveScheme(defaultScheme);
        if (defaultScheme) {
          applyScheme(defaultScheme);
        }
      })
      .catch(() => {
        if (isMounted) {
          message.error(t('加载列配置方案失败。'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [applyScheme, gridApi, scope]);

  const captureState = useCallback(() => {
    if (!gridApi) {
      throw new Error(
        'Cannot capture column view scheme before grid is ready.',
      );
    }
    return captureColumnViewState(
      gridApi.getColumnState() as ColumnViewColumnState[],
      colDefs as SchemeColDef[],
      { includeSort: includeSortState },
    );
  }, [colDefs, gridApi, includeSortState]);

  const getColumnSettings = useCallback(() => {
    if (!gridApi) {
      throw new Error('Cannot edit column settings before grid is ready.');
    }
    return buildColumnSettingItems(
      gridApi.getColumnState() as ColumnViewColumnState[],
      colDefs as SchemeColDef[],
    );
  }, [colDefs, gridApi]);

  const getDefaultColumnSettings = useCallback(
    () => buildDefaultColumnSettingItems(colDefs as SchemeColDef[]),
    [colDefs],
  );

  const applyColumnSettings = useCallback(
    (settings: ColumnSettingItem[]) => {
      if (!gridApi) {
        throw new Error('Cannot apply column settings before grid is ready.');
      }
      gridApi.applyColumnState({
        state: buildColumnStateFromSettings(
          gridApi.getColumnState() as ColumnViewColumnState[],
          settings,
          colDefs as SchemeColDef[],
          { includeSort: includeSortState },
        ) as ApplyColumnState['state'],
        applyOrder: true,
      });
    },
    [colDefs, gridApi, includeSortState],
  );

  const switchScheme = useCallback(
    (schemeId: number | null) => {
      if (schemeId === null) {
        setActiveScheme(null);
        return;
      }
      const nextScheme = schemes.find(scheme => scheme.id === schemeId);
      if (!nextScheme) {
        throw new Error(`Column view scheme ${schemeId} was not loaded.`);
      }
      setActiveScheme(nextScheme);
      applyScheme(nextScheme);
    },
    [applyScheme, schemes],
  );

  const saveActiveScheme = useCallback(async () => {
    if (!activeScheme) {
      throw new Error(
        'Cannot save column view scheme without an active scheme.',
      );
    }
    setSaving(true);
    try {
      const savedScheme = await updateScheme(activeScheme.id, {
        state: captureState(),
      });
      setSchemes(currentSchemes => upsertScheme(currentSchemes, savedScheme));
      setActiveScheme(savedScheme);
      return savedScheme;
    } catch (error) {
      message.error(t('保存列配置方案失败。'));
      throw error;
    } finally {
      setSaving(false);
    }
  }, [activeScheme, captureState]);

  const saveAsScheme = useCallback(
    async (name: string) => {
      setSaving(true);
      try {
        const savedScheme = await createScheme({
          ...scope,
          name,
          state: captureState(),
        });
        setSchemes(currentSchemes => upsertScheme(currentSchemes, savedScheme));
        setActiveScheme(savedScheme);
        return savedScheme;
      } catch (error) {
        message.error(t('保存列配置方案失败。'));
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [captureState, scope],
  );

  const setActiveAsDefault = useCallback(async () => {
    if (!activeScheme) {
      throw new Error('Cannot set default without an active scheme.');
    }
    setSaving(true);
    try {
      const defaultScheme = await setDefaultScheme(activeScheme.id);
      setSchemes(currentSchemes =>
        currentSchemes.map(scheme => ({
          ...scheme,
          is_default: scheme.id === defaultScheme.id,
        })),
      );
      setActiveScheme(defaultScheme);
      return defaultScheme;
    } catch (error) {
      message.error(t('设置默认列配置方案失败。'));
      throw error;
    } finally {
      setSaving(false);
    }
  }, [activeScheme]);

  const resetColumns = useCallback(() => {
    if (!gridApi) {
      throw new Error('Cannot reset columns before grid is ready.');
    }
    gridApi.resetColumnState();
    setActiveScheme(null);
  }, [gridApi]);

  const deleteActiveScheme = useCallback(async () => {
    if (!activeScheme) {
      throw new Error('Cannot delete without an active scheme.');
    }
    setDeleting(true);
    try {
      await deleteScheme(activeScheme.id);
      setSchemes(currentSchemes =>
        currentSchemes.filter(scheme => scheme.id !== activeScheme.id),
      );
      setActiveScheme(null);
    } catch (error) {
      message.error(t('删除列配置方案失败。'));
      throw error;
    } finally {
      setDeleting(false);
    }
  }, [activeScheme]);

  return {
    activeScheme,
    deleteActiveScheme,
    deleting,
    applyColumnSettings,
    getDefaultColumnSettings,
    getColumnSettings,
    loading,
    resetColumns,
    saveActiveScheme,
    saveAsScheme,
    saving,
    schemes,
    setActiveAsDefault,
    switchScheme,
  };
};
