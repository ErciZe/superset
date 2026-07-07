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
import type { ComponentType, ReactNode } from 'react';
import type { QueryFormColumn, QueryFormMetric } from '@superset-ui/core';
import type { ColumnMeta, Metric } from '@superset-ui/chart-controls';

type ControlHeaderProps = {
  description?: ReactNode;
  hovered?: boolean;
  label?: ReactNode;
  name?: string;
  renderTrigger?: boolean;
};

type DndColumnSelectProps = {
  actions?: unknown;
  label?: string;
  multi?: boolean;
  name: string;
  onChange: (value: QueryFormColumn[] | QueryFormColumn | null) => void;
  options?: ColumnMeta[];
  type?: string;
  value?: QueryFormColumn[];
};

type DndMetricSelectProps = {
  columns?: ColumnMeta[];
  datasource?: unknown;
  label?: string;
  multi?: boolean;
  name: string;
  onChange: (value: QueryFormMetric[] | QueryFormMetric | null) => void;
  savedMetrics?: Metric[];
  value?: QueryFormMetric[];
};

const controlHeaderModule = require('../../../../src/explore/components/ControlHeader') as {
  default: ComponentType<ControlHeaderProps>;
};

const dndColumnSelectModule = require('../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect') as {
  DndColumnSelect: ComponentType<DndColumnSelectProps>;
};

const dndColumnSelectControlModule = require('../../../../src/explore/components/controls/DndColumnSelectControl') as {
  DndMetricSelect: ComponentType<DndMetricSelectProps>;
};

export const ControlHeader = controlHeaderModule.default;
export const DndColumnSelect = dndColumnSelectModule.DndColumnSelect;
export const DndMetricSelect = dndColumnSelectControlModule.DndMetricSelect;
