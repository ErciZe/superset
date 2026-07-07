/* eslint-disable camelcase */
/* oxlint-disable react/no-danger */
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

import { t } from '@apache-superset/core/translation';
import { isProbablyHTML, sanitizeHtml } from '@superset-ui/core';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from '@superset-ui/core/components';
import { CellRendererProps } from '../types';
import { SummaryContainer, SummaryText } from '../styles';
import { getRenderableCellValue } from './utils';

const SUMMARY_TOOLTIP_TEXT = t(
  'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
);

export const TextCellRenderer = (params: CellRendererProps) => {
  const { node, api, colDef, columns, allowRenderHtml, value, valueFormatted } =
    params;

  if (node?.rowPinned === 'bottom') {
    const cols = api.getAllGridColumns().filter(col => col.isVisible());
    const colAggCheck = !cols[0].getAggFunc();
    if (cols.length > 1 && colAggCheck && columns[0].key === colDef?.field) {
      return (
        <SummaryContainer>
          <SummaryText>{t('Summary')}</SummaryText>
          <Tooltip overlay={SUMMARY_TOOLTIP_TEXT}>
            <InfoCircleOutlined />
          </Tooltip>
        </SummaryContainer>
      );
    }
    if (!value) {
      return null;
    }
  }

  const additionalFormatting = params.additionalCellFormatter?.({
    ...params,
    col: params.col,
  });
  const additionalContentProps = {
    className: additionalFormatting?.className,
    title: additionalFormatting?.tooltip,
  };
  const hasAdditionalContentProps = Boolean(
    additionalFormatting?.className || additionalFormatting?.tooltip,
  );

  if (additionalFormatting?.html) {
    return (
      <div
        {...additionalContentProps}
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(additionalFormatting.html),
        }}
      />
    );
  }
  if (additionalFormatting && 'text' in additionalFormatting) {
    return (
      <div {...additionalContentProps}>
        {getRenderableCellValue(additionalFormatting.text)}
      </div>
    );
  }

  if (!(typeof value === 'string' || value instanceof Date)) {
    const content = valueFormatted ?? value;
    return hasAdditionalContentProps ? (
      <div {...additionalContentProps}>{content}</div>
    ) : (
      content
    );
  }

  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          {...additionalContentProps}
        >
          {value}
        </a>
      );
    }
    if (allowRenderHtml && isProbablyHTML(value)) {
      return (
        <div
          {...additionalContentProps}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
        />
      );
    }
  }

  return (
    <div {...additionalContentProps}>
      {getRenderableCellValue(valueFormatted ?? value)}
    </div>
  );
};
