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
import { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Input,
  Tooltip,
  Button,
  TextAreaEditor,
  ModalTrigger,
} from '@superset-ui/core/components';
import { t, withTheme } from '@superset-ui/core';

import ControlHeader from 'src/explore/components/ControlHeader';

const MODAL_EDITOR_HEIGHT = 'min(960px, calc(100vh - 180px))';

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  initialValue: PropTypes.string,
  height: PropTypes.number,
  minLines: PropTypes.number,
  maxLines: PropTypes.number,
  offerEditInModal: PropTypes.bool,
  language: PropTypes.oneOf([
    null,
    'json',
    'html',
    'sql',
    'markdown',
    'javascript',
  ]),
  aboveEditorSection: PropTypes.node,
  readOnly: PropTypes.bool,
  resize: PropTypes.oneOf([
    null,
    'block',
    'both',
    'horizontal',
    'inline',
    'none',
    'vertical',
  ]),
  textAreaStyles: PropTypes.object,
  tooltipOptions: PropTypes.object,
  hotkeys: PropTypes.array,
  formatValue: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
  initialValue: '',
  height: 250,
  minLines: 3,
  maxLines: 10,
  offerEditInModal: true,
  readOnly: false,
  resize: null,
  textAreaStyles: {},
  tooltipOptions: {},
  hotkeys: [],
  formatValue: null,
};

export class TextAreaControl extends Component {
  onControlChange(event) {
    const { value } = event.target;
    this.props.onChange(value);
  }

  onAreaEditorChange(value) {
    this.props.onChange(value);
  }

  applyFormattedAreaEditorValue(editor, sourceValue, formattedValue) {
    if (
      typeof formattedValue !== 'string' ||
      formattedValue === sourceValue ||
      editor.getValue() !== sourceValue
    ) {
      return;
    }
    editor.setValue(formattedValue, -1);
    this.props.onChange(formattedValue);
  }

  onAreaEditorBlur(_event, editor) {
    if (!this.props.formatValue || !editor) {
      return;
    }
    const value = editor.getValue();
    try {
      const formattedValue = this.props.formatValue(value);
      if (typeof formattedValue?.then === 'function') {
        formattedValue
          .then(result =>
            this.applyFormattedAreaEditorValue(editor, value, result),
          )
          .catch(() => {});
        return;
      }
      this.applyFormattedAreaEditorValue(editor, value, formattedValue);
    } catch (_error) {
      // Submit-time validators surface formatter errors in the control state.
    }
  }

  resizeEditorAfterMount(editor) {
    if (!editor?.resize) {
      return;
    }

    editor.container?.style?.setProperty(
      'height',
      MODAL_EDITOR_HEIGHT,
      'important',
    );
    editor.resize(true);
    if (typeof window === 'undefined') {
      return;
    }

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => editor.resize(true));
    }
    window.setTimeout(() => editor.resize(true), 100);
  }

  renderEditor(inModal = false) {
    const minLines = this.props.minLines || 12;
    if (this.props.language) {
      const style = {
        border: `1px solid ${this.props.theme.colorBorder}`,
        width: 'auto',
        ...this.props.textAreaStyles,
        ...(inModal
          ? { height: MODAL_EDITOR_HEIGHT }
          : { minHeight: `${minLines}em` }),
      };
      if (this.props.resize) {
        style.resize = this.props.resize;
      }
      if (this.props.readOnly) {
        style.backgroundColor = '#f2f2f2';
      }
      const onEditorLoad = editor => {
        this.props.hotkeys.forEach(keyConfig => {
          editor.commands.addCommand({
            name: keyConfig.name,
            bindKey: { win: keyConfig.key, mac: keyConfig.key },
            exec: keyConfig.func,
          });
        });
        if (inModal) {
          this.resizeEditorAfterMount(editor);
        }
      };
      const codeEditor = (
        <div>
          <TextAreaEditor
            {...this.props}
            mode={this.props.language}
            style={style}
            height={inModal ? MODAL_EDITOR_HEIGHT : undefined}
            minLines={inModal ? undefined : minLines}
            maxLines={inModal ? undefined : this.props.maxLines}
            editorProps={{ $blockScrolling: true }}
            onLoad={onEditorLoad}
            defaultValue={this.props.initialValue}
            readOnly={this.props.readOnly}
            key={this.props.name}
            onChange={this.onAreaEditorChange.bind(this)}
            onBlur={this.onAreaEditorBlur.bind(this)}
          />
        </div>
      );

      if (this.props.tooltipOptions) {
        return <Tooltip {...this.props.tooltipOptions}>{codeEditor}</Tooltip>;
      }
      return codeEditor;
    }

    const textArea = (
      <div>
        <Input.TextArea
          placeholder={t('textarea')}
          onChange={this.onControlChange.bind(this)}
          defaultValue={this.props.initialValue}
          disabled={this.props.readOnly}
          style={{ height: this.props.height }}
          aria-required={this.props['aria-required']}
        />
      </div>
    );
    if (this.props.tooltipOptions) {
      return <Tooltip {...this.props.tooltipOptions}>{textArea}</Tooltip>;
    }
    return textArea;
  }

  renderModalBody() {
    return (
      <>
        <div>{this.props.aboveEditorSection}</div>
        {this.renderEditor(true)}
      </>
    );
  }

  render() {
    const controlHeader = <ControlHeader {...this.props} />;
    return (
      <div>
        {controlHeader}
        {this.renderEditor()}
        {this.props.offerEditInModal && (
          <ModalTrigger
            modalTitle={controlHeader}
            triggerNode={
              <Button
                buttonSize="small"
                style={{ marginTop: this.props.theme.sizeUnit }}
              >
                {t('Edit %s in modal', this.props.language)}
              </Button>
            }
            modalBody={this.renderModalBody(true)}
            responsive
          />
        )}
      </div>
    );
  }
}

TextAreaControl.propTypes = propTypes;
TextAreaControl.defaultProps = defaultProps;

export default withTheme(TextAreaControl);
