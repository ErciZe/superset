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
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';

import WrappedTextAreaControl, {
  TextAreaControl as TextAreaControlComponent,
} from 'src/explore/components/controls/TextAreaControl';

const defaultProps = {
  name: 'x_axis_label',
  label: 'X Axis Label',
  onChange: jest.fn(),
};

describe('TextArea', () => {
  it('renders a FormControl', () => {
    render(<WrappedTextAreaControl {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  it('calls onChange when toggled', () => {
    render(<WrappedTextAreaControl {...defaultProps} />);
    const textArea = screen.getByRole('textbox');
    fireEvent.change(textArea, { target: { value: 'x' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('x');
  });

  it('renders a AceEditor when language is specified', async () => {
    const props = { ...defaultProps, language: 'markdown' };
    const { container } = render(<WrappedTextAreaControl {...props} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('.ace_text-input')).toBeInTheDocument();
    });
  });

  it('calls onAreaEditorChange when entering in the AceEditor', () => {
    const props = { ...defaultProps, language: 'markdown' };
    render(<WrappedTextAreaControl {...props} />);
    const textArea = screen.getByRole('textbox');
    fireEvent.change(textArea, { target: { value: 'x' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('x');
  });

  it('renders the modal AceEditor with the full configured height', async () => {
    const props = {
      ...defaultProps,
      language: 'markdown',
      textAreaStyles: { height: '140px' },
    };
    render(<WrappedTextAreaControl {...props} />);

    fireEvent.click(screen.getByText('Edit markdown in modal'));

    await waitFor(() => {
      expect(document.querySelectorAll('.ace_editor').length).toBeGreaterThan(
        1,
      );
    });

    const editors = document.querySelectorAll('.ace_editor');
    expect(editors[editors.length - 1]).toHaveStyle({
      height: 'min(960px, calc(100vh - 180px))',
    });
  });

  it('applies async AceEditor formatting on blur', async () => {
    const onChange = jest.fn();
    const control = new TextAreaControlComponent({
      ...defaultProps,
      onChange,
      formatValue: jest.fn().mockResolvedValue('formatted'),
    });
    const editor = {
      getValue: jest.fn(() => 'raw'),
      setValue: jest.fn(),
    };

    control.onAreaEditorBlur(null, editor);

    await waitFor(() => {
      expect(editor.setValue).toHaveBeenCalledWith('formatted', -1);
    });
    expect(onChange).toHaveBeenCalledWith('formatted');
  });

  it('keeps AceEditor value unchanged when async formatting fails on blur', async () => {
    const onChange = jest.fn();
    const control = new TextAreaControlComponent({
      ...defaultProps,
      onChange,
      formatValue: jest.fn().mockRejectedValue(new Error('invalid source')),
    });
    const editor = {
      getValue: jest.fn(() => 'raw'),
      setValue: jest.fn(),
    };

    control.onAreaEditorBlur(null, editor);

    await waitFor(() => {
      expect(control.props.formatValue).toHaveBeenCalledWith('raw');
    });
    expect(editor.setValue).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps AceEditor value unchanged when sync formatting throws on blur', () => {
    const onChange = jest.fn();
    const control = new TextAreaControlComponent({
      ...defaultProps,
      onChange,
      formatValue: jest.fn(() => {
        throw new Error('invalid source');
      }),
    });
    const editor = {
      getValue: jest.fn(() => 'raw'),
      setValue: jest.fn(),
    };

    expect(() => control.onAreaEditorBlur(null, editor)).not.toThrow();
    expect(editor.setValue).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
