/**
 * ActionParametersDialogNumberInput
 * Action Parameter Field for a numerical input
*/
import React from 'react';
import PropTypes from 'prop-types';
import { isFinite } from 'lodash';
import { TextField } from '@mui/material';

const ActionParametersDialogNumberInput = (props) => {
  const { actionArgument, value, handleChangeForm, label, error, name } = props;
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

ActionParametersDialogNumberInput.defaultProps = {
  actionArgument: {
    input: {}
  }
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
