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
import type { CSSProperties } from 'react';
import type { DataRecordValue } from '@superset-ui/core';
import type {
  AdditionalCellFormatter,
  AdditionalCellFormatterResult,
} from '../../../plugin-chart-ag-grid-table/src/types';
import { getMatrixRawValueField } from './matrixTransform';

/* eslint-disable no-console */

const ALLOWED_IDENTIFIERS = new Set([
  'row',
  'cell',
  'value',
  'rawValue',
  'column',
  'rowIndex',
  'colDef',
  'console',
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
]);

const FORBIDDEN_PROPERTIES = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'call',
  'apply',
  'bind',
]);

const STYLE_WHITELIST = new Set([
  'backgroundColor',
  'color',
  'fontWeight',
  'fontStyle',
  'textAlign',
  'textDecoration',
  'opacity',
]);

const CONSOLE_METHODS = new Set(['log', 'info', 'warn', 'error']);

type TokenType = 'identifier' | 'number' | 'string' | 'operator' | 'eof';

type Token = {
  type: TokenType;
  value: string;
};

type LiteralNode = {
  type: 'Literal';
  value: unknown;
};

type IdentifierNode = {
  type: 'Identifier';
  name: string;
};

type UnaryNode = {
  type: 'Unary';
  operator: string;
  argument: ExpressionNode;
};

type BinaryNode = {
  type: 'Binary';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
};

type ConditionalNode = {
  type: 'Conditional';
  test: ExpressionNode;
  consequent: ExpressionNode;
  alternate: ExpressionNode;
};

type MemberNode = {
  type: 'Member';
  object: ExpressionNode;
  property: ExpressionNode | string;
};

type CallNode = {
  type: 'Call';
  callee: ExpressionNode;
  args: ExpressionNode[];
};

type ObjectNode = {
  type: 'Object';
  properties: Array<{ key: string; value: ExpressionNode }>;
};

type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | UnaryNode
  | BinaryNode
  | ConditionalNode
  | MemberNode
  | CallNode
  | ObjectNode;

type EvaluationScope = Record<string, unknown>;

const isIdentifierStart = (char: string | undefined) =>
  Boolean(char && /[$A-Z_a-z]/.test(char));

const isIdentifierPart = (char: string | undefined) =>
  Boolean(char && /[$0-9A-Z_a-z]/.test(char));

const readString = (source: string, start: number) => {
  const quote = source[start];
  let value = '';
  let cursor = start + 1;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === '\\') {
      cursor += 1;
      value += source[cursor] ?? '';
      cursor += 1;
      continue;
    }
    if (char === quote) {
      return { value, end: cursor + 1 };
    }
    value += char;
    cursor += 1;
  }
  throw new Error(
    'Matrix cell formatter expression has an unterminated string.',
  );
};

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  for (let cursor = 0; cursor < source.length; ) {
    const char = source[cursor];
    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }
    if (char === '`' || char === ';') {
      throw new Error('Matrix cell formatter expression must be one expression.');
    }
    if (char === '/' && source[cursor + 1] === '/') {
      const end = source.indexOf('\n', cursor + 2);
      cursor = end === -1 ? source.length : end + 1;
      continue;
    }
    if (char === '/' && source[cursor + 1] === '*') {
      const end = source.indexOf('*/', cursor + 2);
      if (end === -1) {
        throw new Error(
          'Matrix cell formatter expression has an unterminated comment.',
        );
      }
      cursor = end + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      const stringToken = readString(source, cursor);
      tokens.push({ type: 'string', value: stringToken.value });
      cursor = stringToken.end;
      continue;
    }
    if (/\d/.test(char) || (char === '.' && /\d/.test(source[cursor + 1]))) {
      const match = source.slice(cursor).match(/^(?:\d+\.?\d*|\.\d+)/);
      if (!match) {
        throw new Error('Matrix cell formatter expression has invalid number.');
      }
      tokens.push({ type: 'number', value: match[0] });
      cursor += match[0].length;
      continue;
    }
    if (isIdentifierStart(char)) {
      const start = cursor;
      cursor += 1;
      while (isIdentifierPart(source[cursor])) {
        cursor += 1;
      }
      tokens.push({ type: 'identifier', value: source.slice(start, cursor) });
      continue;
    }
    const threeChar = source.slice(cursor, cursor + 3);
    const twoChar = source.slice(cursor, cursor + 2);
    if (['===', '!=='].includes(threeChar)) {
      tokens.push({ type: 'operator', value: threeChar });
      cursor += 3;
      continue;
    }
    if (['&&', '||', '==', '!=', '<=', '>='].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar });
      cursor += 2;
      continue;
    }
    if ('+-*/%<>(){}[]?:.,!'.includes(char)) {
      tokens.push({ type: 'operator', value: char });
      cursor += 1;
      continue;
    }
    throw new Error(
      `Matrix cell formatter expression has unsupported token "${char}".`,
    );
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
};

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: Token[]) {}

  parse() {
    const expression = this.parseExpression(true);
    if (this.current().type !== 'eof') {
      throw new Error('Matrix cell formatter expression expected "eof".');
    }
    return expression;
  }

  private parseExpression(allowComma: boolean): ExpressionNode {
    let node = this.parseConditional();
    if (!allowComma) {
      return node;
    }
    while (this.match(',')) {
      node = {
        type: 'Binary',
        operator: ',',
        left: node,
        right: this.parseConditional(),
      };
    }
    return node;
  }

  private current() {
    return this.tokens[this.cursor];
  }

  private match(value: string) {
    if (this.current().value === value) {
      this.cursor += 1;
      return true;
    }
    return false;
  }

  private expect(value: string) {
    if (!this.match(value)) {
      throw new Error(
        `Matrix cell formatter expression expected "${value}".`,
      );
    }
  }

  private parseConditional(): ExpressionNode {
    const test = this.parseLogicalOr();
    if (!this.match('?')) {
      return test;
    }
    const consequent = this.parseExpression(false);
    this.expect(':');
    return {
      type: 'Conditional',
      test,
      consequent,
      alternate: this.parseExpression(false),
    };
  }

  private parseLogicalOr() {
    return this.parseBinary(() => this.parseLogicalAnd(), ['||']);
  }

  private parseLogicalAnd() {
    return this.parseBinary(() => this.parseEquality(), ['&&']);
  }

  private parseEquality() {
    return this.parseBinary(() => this.parseRelational(), [
      '===',
      '!==',
      '==',
      '!=',
    ]);
  }

  private parseRelational() {
    return this.parseBinary(() => this.parseAdditive(), [
      '<',
      '<=',
      '>',
      '>=',
    ]);
  }

  private parseAdditive() {
    return this.parseBinary(() => this.parseMultiplicative(), ['+', '-']);
  }

  private parseMultiplicative() {
    return this.parseBinary(() => this.parseUnary(), ['*', '/', '%']);
  }

  private parseBinary(
    parseOperand: () => ExpressionNode,
    operators: string[],
  ) {
    let node = parseOperand();
    while (operators.includes(this.current().value)) {
      const operator = this.current().value;
      this.cursor += 1;
      node = {
        type: 'Binary',
        operator,
        left: node,
        right: parseOperand(),
      };
    }
    return node;
  }

  private parseUnary(): ExpressionNode {
    if (['!', '-', '+'].includes(this.current().value)) {
      const operator = this.current().value;
      this.cursor += 1;
      return {
        type: 'Unary',
        operator,
        argument: this.parseUnary(),
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): ExpressionNode {
    let node = this.parsePrimary();
    for (;;) {
      if (this.match('.')) {
        const property = this.current();
        if (property.type !== 'identifier') {
          throw new Error(
            'Matrix cell formatter member access requires a property name.',
          );
        }
        assertPropertyAllowed(property.value);
        this.cursor += 1;
        node = { type: 'Member', object: node, property: property.value };
        continue;
      }
      if (this.match('[')) {
        const property = this.parseExpression(false);
        if (property.type === 'Literal' && typeof property.value === 'string') {
          assertPropertyAllowed(property.value);
        }
        this.expect(']');
        node = { type: 'Member', object: node, property };
        continue;
      }
      if (this.match('(')) {
        const args: ExpressionNode[] = [];
        if (!this.match(')')) {
          do {
            args.push(this.parseExpression(false));
          } while (this.match(','));
          this.expect(')');
        }
        node = { type: 'Call', callee: node, args };
        continue;
      }
      return node;
    }
  }

  private parsePrimary(): ExpressionNode {
    const token = this.current();
    if (token.type === 'number') {
      this.cursor += 1;
      return { type: 'Literal', value: Number(token.value) };
    }
    if (token.type === 'string') {
      this.cursor += 1;
      return { type: 'Literal', value: token.value };
    }
    if (token.type === 'identifier') {
      this.cursor += 1;
      assertIdentifierAllowed(token.value);
      if (token.value === 'true') {
        return { type: 'Literal', value: true };
      }
      if (token.value === 'false') {
        return { type: 'Literal', value: false };
      }
      if (token.value === 'null') {
        return { type: 'Literal', value: null };
      }
      if (token.value === 'undefined') {
        return { type: 'Literal', value: undefined };
      }
      if (token.value === 'NaN') {
        return { type: 'Literal', value: NaN };
      }
      if (token.value === 'Infinity') {
        return { type: 'Literal', value: Infinity };
      }
      return { type: 'Identifier', name: token.value };
    }
    if (this.match('(')) {
      const expression = this.parseExpression(true);
      this.expect(')');
      return expression;
    }
    if (this.match('{')) {
      return this.parseObject();
    }
    throw new Error('Matrix cell formatter expression has invalid syntax.');
  }

  private parseObject(): ExpressionNode {
    const properties: ObjectNode['properties'] = [];
    if (!this.match('}')) {
      do {
        const token = this.current();
        if (token.type !== 'identifier' && token.type !== 'string') {
          throw new Error(
            'Matrix cell formatter object literal requires property keys.',
          );
        }
        assertPropertyAllowed(token.value);
        this.cursor += 1;
        this.expect(':');
        properties.push({ key: token.value, value: this.parseExpression(false) });
      } while (this.match(','));
      this.expect('}');
    }
    return { type: 'Object', properties };
  }
}

const assertIdentifierAllowed = (identifier: string) => {
  if (!ALLOWED_IDENTIFIERS.has(identifier)) {
    throw new Error(
      `Matrix cell formatter expression uses unsupported identifier "${identifier}".`,
    );
  }
};

const assertPropertyAllowed = (property: string) => {
  if (FORBIDDEN_PROPERTIES.has(property)) {
    throw new Error(
      `Matrix cell formatter expression cannot access property "${property}".`,
    );
  }
};

const toPropertyKey = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;

const evaluateNode = (
  node: ExpressionNode,
  scope: EvaluationScope,
): unknown => {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'Identifier':
      return scope[node.name];
    case 'Unary': {
      const value = evaluateNode(node.argument, scope);
      if (node.operator === '!') {
        return !value;
      }
      if (node.operator === '-') {
        return -Number(value);
      }
      return Number(value);
    }
    case 'Binary':
      return evaluateBinary(node, scope);
    case 'Conditional':
      return evaluateNode(
        evaluateNode(node.test, scope) ? node.consequent : node.alternate,
        scope,
      );
    case 'Member': {
      const object = evaluateNode(node.object, scope);
      const property =
        typeof node.property === 'string'
          ? node.property
          : toPropertyKey(evaluateNode(node.property, scope));
      if (!property) {
        return undefined;
      }
      assertPropertyAllowed(property);
      if (!object || typeof object !== 'object') {
        return undefined;
      }
      return (object as Record<string, unknown>)[property];
    }
    case 'Call':
      return evaluateCall(node, scope);
    case 'Object':
      return Object.fromEntries(
        node.properties.map(property => [
          property.key,
          evaluateNode(property.value, scope),
        ]),
      );
    default:
      return undefined;
  }
};

const evaluateBinary = (node: BinaryNode, scope: EvaluationScope) => {
  if (node.operator === '&&') {
    return evaluateNode(node.left, scope) && evaluateNode(node.right, scope);
  }
  if (node.operator === '||') {
    return evaluateNode(node.left, scope) || evaluateNode(node.right, scope);
  }
  if (node.operator === ',') {
    evaluateNode(node.left, scope);
    return evaluateNode(node.right, scope);
  }

  const left = evaluateNode(node.left, scope);
  const right = evaluateNode(node.right, scope);
  switch (node.operator) {
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '==':
      return left == right; // eslint-disable-line eqeqeq
    case '!=':
      return left != right; // eslint-disable-line eqeqeq
    case '<':
      return Number(left) < Number(right);
    case '<=':
      return Number(left) <= Number(right);
    case '>':
      return Number(left) > Number(right);
    case '>=':
      return Number(left) >= Number(right);
    case '+':
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left) + String(right);
      }
      return Number(left) + Number(right);
    case '-':
      return Number(left) - Number(right);
    case '*':
      return Number(left) * Number(right);
    case '/':
      return Number(left) / Number(right);
    case '%':
      return Number(left) % Number(right);
    default:
      throw new Error(
        `Matrix cell formatter expression has unsupported operator "${node.operator}".`,
      );
  }
};

const evaluateCall = (node: CallNode, scope: EvaluationScope) => {
  if (
    node.callee.type !== 'Member' ||
    node.callee.object.type !== 'Identifier' ||
    node.callee.object.name !== 'console' ||
    typeof node.callee.property !== 'string' ||
    !CONSOLE_METHODS.has(node.callee.property)
  ) {
    throw new Error('Matrix cell formatter expression can only call console.');
  }
  const args = node.args.map(arg => evaluateNode(arg, scope));
  console[node.callee.property as 'log'](...args);
  return undefined;
};

const sanitizeStyle = (style: unknown): Partial<CSSProperties> | undefined => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(style as Record<string, unknown>)
      .filter(
        ([key, value]) =>
          STYLE_WHITELIST.has(key) &&
          (typeof value === 'string' || typeof value === 'number'),
      )
      .map(([key, value]) => [key, value]),
  ) as Partial<CSSProperties>;
};

const normalizeFormatterResult = (
  result: unknown,
): AdditionalCellFormatterResult | undefined => {
  if (result === undefined) {
    return undefined;
  }
  if (
    result === null ||
    ['string', 'number', 'boolean'].includes(typeof result)
  ) {
    return { text: result as DataRecordValue };
  }
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Matrix cell formatter expression must return an object.');
  }

  const rawResult = result as Record<string, unknown>;
  return {
    ...('text' in rawResult
      ? { text: rawResult.text as DataRecordValue }
      : undefined),
    ...(typeof rawResult.html === 'string' ? { html: rawResult.html } : {}),
    ...(typeof rawResult.className === 'string'
      ? { className: rawResult.className }
      : {}),
    ...(typeof rawResult.tooltip === 'string'
      ? { tooltip: rawResult.tooltip }
      : {}),
    ...(rawResult.style ? { style: sanitizeStyle(rawResult.style) } : {}),
  };
};

export const validateMatrixCellFormatterExpression = (source: string) => {
  new Parser(tokenize(source)).parse();
};

export const createMatrixCellFormatter = (
  expression: string | null | undefined,
): AdditionalCellFormatter | undefined => {
  const source = expression?.trim();
  if (!source) {
    return undefined;
  }

  const ast = new Parser(tokenize(source)).parse();

  return params => {
    const field = String(params.colDef?.field ?? params.col.key);
    const rawValue =
      params.data?.[getMatrixRawValueField(field)] ?? params.value;
    const cell = {
      field,
      value: params.value,
      formattedValue: params.valueFormatted,
      rawValue,
    };

    return normalizeFormatterResult(
      evaluateNode(ast, {
        row: params.data ?? {},
        cell,
        value: params.value,
        rawValue,
        column: params.col,
        rowIndex: params.rowIndex,
        colDef: params.colDef,
        console,
      }),
    );
  };
};
