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

import type {
  CrosstabCalculatedField,
  CrosstabExpressionNode,
} from '../../types';
import { validateCalculatedFieldAst } from './expr';

export type ExpressionDraft =
  | { kind: 'metric_ref'; metricId: string }
  | { kind: 'number_param'; parameterId: string }
  | { kind: 'literal_number'; value: string }
  | {
      kind: 'binary_op';
      op: '+' | '-' | '*' | '/';
      left: ExpressionDraft;
      right: ExpressionDraft;
    }
  | {
      kind: 'safe_div' | 'pct' | 'ratio';
      numerator: ExpressionDraft;
      denominator: ExpressionDraft;
      defaultValue?: string;
    };

export type ExpressionPreviewLabels = {
  metrics: Record<string, string>;
  parameters: Record<string, string>;
};

type CreateExpressionDraftArgs = {
  denominatorMetricId?: string;
  kind?: ExpressionDraft['kind'];
  numeratorMetricId?: string;
  parameterId?: string;
};

function metricRef(metricId?: string): ExpressionDraft {
  return {
    kind: 'metric_ref',
    metricId: metricId ?? '',
  };
}

function numberParam(parameterId?: string): ExpressionDraft {
  return {
    kind: 'number_param',
    parameterId: parameterId ?? '',
  };
}

export function createExpressionDraft({
  denominatorMetricId,
  kind = 'pct',
  numeratorMetricId,
  parameterId,
}: CreateExpressionDraftArgs = {}): ExpressionDraft {
  switch (kind) {
    case 'metric_ref':
      return metricRef(numeratorMetricId);
    case 'number_param':
      return numberParam(parameterId);
    case 'literal_number':
      return { kind: 'literal_number', value: '1' };
    case 'binary_op':
      return {
        kind: 'binary_op',
        op: '*',
        left: createExpressionDraft({
          denominatorMetricId,
          kind: 'pct',
          numeratorMetricId,
        }),
        right:
          parameterId === undefined
            ? createExpressionDraft({ kind: 'literal_number' })
            : createExpressionDraft({ kind: 'number_param', parameterId }),
      };
    case 'safe_div':
      return {
        kind,
        numerator: metricRef(numeratorMetricId),
        denominator: metricRef(denominatorMetricId),
        defaultValue: '0',
      };
    case 'pct':
    case 'ratio':
      return {
        kind,
        numerator: metricRef(numeratorMetricId),
        denominator: metricRef(denominatorMetricId),
      };
    default:
      return {
        kind: 'pct',
        numerator: metricRef(numeratorMetricId),
        denominator: metricRef(denominatorMetricId),
      };
  }
}

export function astToDraft(node: CrosstabExpressionNode): ExpressionDraft {
  switch (node.kind) {
    case 'metric_ref':
      return { kind: 'metric_ref', metricId: node.metricId };
    case 'number_param':
      return { kind: 'number_param', parameterId: node.parameterId };
    case 'literal_number':
      return { kind: 'literal_number', value: String(node.value) };
    case 'binary_op':
      return {
        kind: 'binary_op',
        op: node.op,
        left: astToDraft(node.left),
        right: astToDraft(node.right),
      };
    case 'safe_div':
      return {
        kind: 'safe_div',
        numerator: astToDraft(node.numerator),
        denominator: astToDraft(node.denominator),
        defaultValue:
          node.defaultValue === undefined
            ? undefined
            : String(node.defaultValue),
      };
    case 'pct':
      return {
        kind: 'pct',
        numerator: astToDraft(node.numerator),
        denominator: astToDraft(node.denominator),
      };
    case 'ratio':
      return {
        kind: 'ratio',
        numerator: astToDraft(node.numerator),
        denominator: astToDraft(node.denominator),
      };
    default:
      throw new Error(t('Unsupported expression node.'));
  }
}

function parseFiniteNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(t('Expression literals require finite numbers.'));
  }

  return parsed;
}

export function draftToAst(draft: ExpressionDraft): CrosstabExpressionNode {
  switch (draft.kind) {
    case 'metric_ref':
      if (draft.metricId.trim().length === 0) {
        throw new Error(t('Metric references require a metric.'));
      }
      return { kind: 'metric_ref', metricId: draft.metricId };
    case 'number_param':
      if (draft.parameterId.trim().length === 0) {
        throw new Error(t('Parameter references require a parameter.'));
      }
      return { kind: 'number_param', parameterId: draft.parameterId };
    case 'literal_number':
      return {
        kind: 'literal_number',
        value: parseFiniteNumber(draft.value),
      };
    case 'binary_op':
      return {
        kind: 'binary_op',
        op: draft.op,
        left: draftToAst(draft.left),
        right: draftToAst(draft.right),
      };
    case 'safe_div':
      return {
        kind: 'safe_div',
        numerator: draftToAst(draft.numerator),
        denominator: draftToAst(draft.denominator),
        ...(draft.defaultValue === undefined ||
        draft.defaultValue.trim().length === 0
          ? {}
          : { defaultValue: parseFiniteNumber(draft.defaultValue) }),
      };
    case 'pct':
      return {
        kind: 'pct',
        numerator: draftToAst(draft.numerator),
        denominator: draftToAst(draft.denominator),
      };
    case 'ratio':
      return {
        kind: 'ratio',
        numerator: draftToAst(draft.numerator),
        denominator: draftToAst(draft.denominator),
      };
    default:
      throw new Error(t('Unsupported expression draft.'));
  }
}

export function duplicateCalculatedField(
  field: CrosstabCalculatedField,
): CrosstabCalculatedField {
  return {
    ...field,
    id: `${field.id}_copy`,
    name: `${field.name} Copy`,
  };
}

function previewNode(
  draft: ExpressionDraft,
  labels: ExpressionPreviewLabels,
): string {
  switch (draft.kind) {
    case 'metric_ref':
      return labels.metrics[draft.metricId] ?? draft.metricId ?? '?metric';
    case 'number_param':
      return `${
        labels.parameters[draft.parameterId] ?? draft.parameterId ?? 'parameter'
      }`;
    case 'literal_number':
      return draft.value.trim().length === 0 ? '?' : draft.value;
    case 'binary_op':
      return `(${previewNode(draft.left, labels)} ${draft.op} ${previewNode(
        draft.right,
        labels,
      )})`;
    case 'safe_div':
      return `safe_div(${previewNode(
        draft.numerator,
        labels,
      )}, ${previewNode(draft.denominator, labels)})`;
    case 'pct':
      return `pct(${previewNode(draft.numerator, labels)}, ${previewNode(
        draft.denominator,
        labels,
      )})`;
    case 'ratio':
      return `ratio(${previewNode(draft.numerator, labels)}, ${previewNode(
        draft.denominator,
        labels,
      )})`;
    default:
      return '?';
  }
}

export function previewExpression(
  draft: ExpressionDraft,
  labels: ExpressionPreviewLabels,
): string {
  return previewNode(draft, labels);
}

export function validateExpressionDraft(draft: ExpressionDraft): string {
  try {
    validateCalculatedFieldAst(draftToAst(draft));
    return t('Ready to save.');
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return t('Expression is invalid.');
  }
}
