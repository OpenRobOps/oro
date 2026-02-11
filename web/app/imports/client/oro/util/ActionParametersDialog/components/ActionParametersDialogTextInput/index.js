/**
 * ActionParametersDialogTextInput
 * Action Parameter Field for a text input
 * It is used for when the value input has to be a string
*/
import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import {
  TextField,
  RadioGroup,
  FormControl,
  Radio,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
// InOrbit modules
import { ACTION_ARGUMENT_INPUT_TYPES } from '../../../../../../shared/actions';
import { getOptionValue, getOptionLabel } from '../../../../../../lib/util';

const useStyles = makeStyles()(() => ({
  selectContainer: {
    width: '100%'
  },
  inputLabel: {
    color: '#757575',
    fontSize: '13px',
  },
  input: {
    padding: '0px 0px 2px'
  }
}));

// Max options values so that the options are displayed as radio button
const MAX_OPTIONS_TO_BE_RADIO_BUTTON = 5;

const ActionParametersDialogTextInput = (props) => {
  const {
    actionArgument, value, handleChangeForm, label, error, attributeValues, name
  } = props;
  const { classes } = useStyles();
  const handleOnChange = event => handleChangeForm(name, event.target.value);

  const { control, attributeId } = actionArgument.input || {};
  // If the argument options come from a datasource, fetch it from the provided argumentValues
  let options = attributeId && attributeValues
    && attributeValues[attributeId] && attributeValues[attributeId].value;
  if (!Array.isArray(options)) {
    // if not using data source, use the defined argument `values` as options
    options = actionArgument.input && actionArgument.input.values;
  }
  if (!Array.isArray(options)) {
    // If still failing - fail gracefully
    console.warn('Supplied a non-array value for a select');
    options = [];
  }

  return (
    <>
      { /* A text field is used for 'text' inputs, or if there are no options for a 'select'
      input whose attribute is not available */
        (control === ACTION_ARGUMENT_INPUT_TYPES.TEXT
          || (control === ACTION_ARGUMENT_INPUT_TYPES.SELECT && !options.length)) && (
          <TextField
            required={actionArgument.required}
            label={label}
            value={value}
            onChange={handleOnChange}
            error={error && error.message}
            InputLabelProps={{
              shrink: true,
              className: classes.input,
            }}
            helperText={error && error.message}
            fullWidth
          />
        )
      }
      {(control === ACTION_ARGUMENT_INPUT_TYPES.SELECT && options.length) && (
        options.length <= MAX_OPTIONS_TO_BE_RADIO_BUTTON ? (
          <>
            <InputLabel className={classes.inputLabel}>
              {label}
            </InputLabel>
            <RadioGroup aria-label={label} value={value} onChange={handleOnChange}>
              {options.map(option => (
                <FormControlLabel
                  value={getOptionValue(option)}
                  control={<Radio />}
                  label={getOptionLabel(option)}
                  key={getOptionValue(option)}
                />
              ))}
            </RadioGroup>
          </>
        ) : (
          <FormControl className={classes.selectContainer}>
            <InputLabel className={classes.inputLabel}>
              {label}
            </InputLabel>
            <Select labelId="demo-simple-select-label" value={value} onChange={handleOnChange}>
              {options.map(option => (
                <MenuItem value={getOptionValue(option)} key={getOptionValue(option)}>
                  {getOptionLabel(option)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )
      )}
    </>
  );
};

ActionParametersDialogTextInput.defaultProps = {
  actionArgument: {
    input: {}
  }
};

ActionParametersDialogTextInput.propTypes = {
  value: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.object,
  name: PropTypes.string,
  handleChangeForm: PropTypes.func,
  actionArgument: PropTypes.shape({
    input: PropTypes.shape({
      required: PropTypes.bool,
      control: PropTypes.string,
      values: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.string
        })
      ),
      attributeId: PropTypes.string
    })
  }),
  // attributeValues contains the robot's attribute values at the time of running the action,
  // so options for selects can be constructed if they come from a data source
  attributeValues: PropTypes.object
};

export default ActionParametersDialogTextInput;
