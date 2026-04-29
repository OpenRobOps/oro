/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * ActionParametersDialogNumberInput
 * Action Parameter Field for a numerical input
*/
import React from 'react';
import PropTypes from 'prop-types';
import { isFinite } from 'lodash';
import { TextField } from '@mui/material';

const ActionParametersDialogNumberInput = (props) => {
  const {
    actionArgument = {
      input: {}
    },
    value,
    handleChangeForm,
    label,
    error,
    name
  } = props;
  const displayValue = isFinite(value) ? value : '';
  const handleOnChange = event => handleChangeForm(name, parseFloat(event.target.value));
  const { max, min } = actionArgument.input;
  const rangeProps = {
    inputProps: {
      max,
      min
    }
  };

  return (
    <TextField
      required={actionArgument.required}
      label={label}
      value={displayValue}
      onChange={handleOnChange}
      type="number"
      InputLabelProps={{ shrink: true }}
      InputProps={rangeProps}
      error={error && error.message}
      helperText={error && error.message}
      fullWidth
    />
  );
};

ActionParametersDialogNumberInput.propTypes = {
  value: PropTypes.number,
  label: PropTypes.string,
  name: PropTypes.string,
  error: PropTypes.object,
  handleChangeForm: PropTypes.func,
  actionArgument: PropTypes.shape({
    required: PropTypes.bool,
    input: PropTypes.shape({
      min: PropTypes.number,
      max: PropTypes.number
    })
  })
};

export default ActionParametersDialogNumberInput;
