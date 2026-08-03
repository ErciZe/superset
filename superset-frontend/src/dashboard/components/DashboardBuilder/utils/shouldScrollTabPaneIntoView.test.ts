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
import shouldScrollTabPaneIntoView from './shouldScrollTabPaneIntoView';

const tabPane = document.createElement('div');
tabPane.className = 'ant-tabs-tabpane';

test('scrolls to the top when keyboard navigation focuses a nearby tab pane', () => {
  expect(shouldScrollTabPaneIntoView(true, tabPane, 100)).toBe(true);
});

test('does not scroll to the top when a mouse interaction focuses a tab pane', () => {
  expect(shouldScrollTabPaneIntoView(false, tabPane, 100)).toBe(false);
});

test('does not scroll when the tab pane is outside the top page range', () => {
  expect(shouldScrollTabPaneIntoView(true, tabPane, 220)).toBe(false);
});
