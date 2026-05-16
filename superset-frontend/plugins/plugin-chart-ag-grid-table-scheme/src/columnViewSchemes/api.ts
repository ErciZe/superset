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
import { SupersetClient } from '@superset-ui/core';
import type { ColumnViewScheme, ColumnViewSchemeState } from './types';

const baseEndpoint = '/api/v1/column_view_scheme/';
const defaultEndpoint = '/api/v1/column_view_scheme/default';

export type ColumnViewSchemeScope = {
  chartId: number;
  dashboardId?: number | null;
  datasetId?: number | null;
};

type CreateSchemePayload = ColumnViewSchemeScope & {
  name: string;
  description?: string | null;
  isDefault?: boolean;
  state: ColumnViewSchemeState;
};

type UpdateSchemePayload = {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  state?: ColumnViewSchemeState;
};

type JsonResponse<T> = {
  result: T;
};

const makeQuery = ({ chartId, dashboardId }: ColumnViewSchemeScope) => {
  const params = new URLSearchParams({ chart_id: String(chartId) });
  if (dashboardId !== undefined && dashboardId !== null) {
    params.set('dashboard_id', String(dashboardId));
  }
  return params.toString();
};

export const fetchSchemes = async (scope: ColumnViewSchemeScope) => {
  const { json } = await SupersetClient.get({
    endpoint: `${baseEndpoint}?${makeQuery(scope)}`,
  });
  return (json as JsonResponse<ColumnViewScheme[]>).result;
};

export const fetchDefaultScheme = async (scope: ColumnViewSchemeScope) => {
  const { json } = await SupersetClient.get({
    endpoint: `${defaultEndpoint}?${makeQuery(scope)}`,
  });
  return (json as JsonResponse<ColumnViewScheme | null>).result;
};

export const createScheme = async ({
  chartId,
  dashboardId,
  datasetId,
  isDefault,
  ...payload
}: CreateSchemePayload) => {
  const { json } = await SupersetClient.post({
    endpoint: baseEndpoint,
    jsonPayload: {
      chart_id: chartId,
      dashboard_id: dashboardId,
      dataset_id: datasetId,
      is_default: isDefault,
      ...payload,
    },
  });
  return (json as JsonResponse<ColumnViewScheme>).result;
};

export const updateScheme = async (
  schemeId: number,
  { isDefault, ...payload }: UpdateSchemePayload,
) => {
  const { json } = await SupersetClient.put({
    endpoint: `${baseEndpoint}${schemeId}`,
    jsonPayload: {
      is_default: isDefault,
      ...payload,
    },
  });
  return (json as JsonResponse<ColumnViewScheme>).result;
};

export const deleteScheme = (schemeId: number) =>
  SupersetClient.delete({
    endpoint: `${baseEndpoint}${schemeId}`,
  });

export const setDefaultScheme = async (schemeId: number) => {
  const { json } = await SupersetClient.post({
    endpoint: `${baseEndpoint}${schemeId}/set_default`,
    jsonPayload: {},
  });
  return (json as JsonResponse<ColumnViewScheme>).result;
};
