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
import HierarchyCellRenderer from '../../../src/table/renderers/HierarchyCellRenderer';

const expandedMeta = {
  depth: 0,
  path: '["8010S"]',
  firstInGroup: true,
  hasDescendants: true,
  expanded: true,
};

test('renders an accessible collapse action for an expanded group', async () => {
  const onToggle = jest.fn();

  render(
    <HierarchyCellRenderer
      value="8010S"
      valueFormatted="8010S"
      meta={expandedMeta}
      onToggle={onToggle}
    />,
  );

  const button = screen.getByRole('button', { name: 'Collapse 8010S' });
  expect(button).toBeVisible();

  await userEvent.click(button);

  expect(onToggle).toHaveBeenCalledWith('["8010S"]');
});

test('renders an expand action for a collapsed group', () => {
  render(
    <HierarchyCellRenderer
      value="8010S"
      valueFormatted="8010S"
      meta={{ ...expandedMeta, expanded: false }}
      onToggle={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Expand 8010S' })).toBeVisible();
});

test('renders a leaf value without a toggle button', () => {
  render(
    <HierarchyCellRenderer
      value="8010S-BL28"
      valueFormatted="8010S-BL28"
      meta={{ ...expandedMeta, hasDescendants: false }}
      onToggle={jest.fn()}
    />,
  );

  expect(screen.getByText('8010S-BL28')).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('hides repeated hierarchy values', () => {
  render(
    <HierarchyCellRenderer
      value="8010S"
      valueFormatted="8010S"
      meta={{ ...expandedMeta, firstInGroup: false }}
      onToggle={jest.fn()}
    />,
  );

  expect(screen.queryByText('8010S')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
