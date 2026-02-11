/**
 * ActionParametersDialog
 * Dialog to send particular parameters to actions executions
 * The Dialog will open after action button is pressed
 * The Dialog displays the parameters or arguments the action has defined
 * The user can then change the values of this parameters and submit the action
 * with the custom parameters
*/
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Validator from 'fastest-validator';
import { isEmpty } from 'lodash';
import { makeStyles } from 'tss-react/mui';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  DialogActions,
  Button
} from '@mui/material';
import classnames from 'classnames';
// InOrbit modules
import ActionParametersDialogNumberInput from './components/ActionParametersDialogNumberInput';
import ActionParametersDialogTextInput from './components/ActionParametersDialogTextInput';
import { ACTION_ARGUMENT_TYPES, ARG_FIELDS, actionArgSpecToSchema, isDummyArgName } from '../../../../shared/actions';
import ActionIcon from '../../graphics/op/ActionIcon';

const useStyles = makeStyles()(theme => ({
  dialogContainer: {
    minWidth: '400px'
  },
  dialogTitleContainer: {
    display: 'flex',
    padding: '19px 12px 0 19px'
  },
  dialogTitle: {
    fontSize: '16px',
  },
  actionName: {
    fontWeight: theme.fontWeight.bold,
    padding: '0 4px 0 7px',
    textTransform: 'uppercase'
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    margin: 'auto',
    width: '350px',
    padding: '19px 30px 30px 30px !important',
  },
  inputContainer: {
    margin: '11px 0',
    padding: '0 16px'
  },
  buttonContainer: {
    minHeight: '60px',
    padding: '0 30px 19px 30px'
  },
  descriptionContainer: {
    marginTop: '19px'
  },
  descriptionTypography: {
    fontSize: '14px',
    margin: 0
  }
}));

// Shorthands for field constants
const { INPUT, ATTRIBUTE, VALUE } = ARG_FIELDS;

const ActionParametersDialog = ({
  handleClose,
  open,
  actionArguments = {},
  attributeValues,
  saveChanges
}) => {
  const { elementList, elementValues, label, description } = actionArguments;
  const v = new Validator();
  const { classes } = useStyles();
  // Parse default argument values, which appear in the { value } field of
  // each argument or referenced as `input.attributeId` if its default comes
  // from a data source. They will be the component's state
  const argDefaultValues = Array.isArray(elementList) && elementList.reduce(
    (accum, key) => {
      const argDef = elementValues[key];
      if (argDef && argDef[INPUT]) { // only collect values in state for args with user input
        const attributeId = argDef[ATTRIBUTE];
        if (attributeId && attributeValues && attributeValues[attributeId]
          && 'value' in attributeValues[attributeId]) {
          // if expecting to default to an attribute, AND the attribute value is available
          accum[key] = attributeValues[attributeId].value;
        } else if (argDef[VALUE]) {
          // default to 'value'; including the case when the attribute value is not in the robot
          accum[key] = argDef[VALUE];
        }
      }
      return accum;
    },
    {}
  );

  // values { key: value } structure
  // pair of key value with the from values
  const [values, setValues] = useState(argDefaultValues);
  // errors { key: { message: string, ... }} structure
  // if the key has errors then it will be added with its message
  const [errors, setErrors] = useState({});

  const handleChangeForm = (name, value) => {
    // Build schema for updated value
    const schema = { [name]: actionArgSpecToSchema(elementValues[name]) };
    const check = v.compile(schema);

    // new key-value
    const updateValue = { [name]: value };
    // Validate with schema
    const validation = check(updateValue, schema);

    // If there is at least one error
    if (validation && validation.length) {
      // Save the first error message
      setErrors({ ...errors, [validation[0].field]: { message: validation[0].message } });
    } else if (errors[name]) {
      // If there is no error in the new validation but is had an error before
      // then the field error is removed
      const { [name]: tmp, ...rest } = errors;
      setErrors(rest);
    }

    setValues({ ...values, ...updateValue });
  };

  const handleSubmit = () => {
    saveChanges(values);
    // TODO (franguerini): Do proper validation of arguments before submitting and
    // prevent from clicking submit button
    handleClose();
  };

  const getArgName = useCallback((argName, ix) => {
    if (elementValues[argName]?.input?.label) {
      return elementValues[argName].input.label;
    } else if (isDummyArgName(argName)) {
      return `Argument #${ix}`;
    } else {
      return argName;
    }
  }, [elementValues]);

  return (
    <Dialog
      className={classes.dialogContainer}
      onClose={handleClose}
      open={open}
      disablePortal
    >
      <DialogTitle className={classes.dialogTitleContainer}>
        <ActionIcon width="13px" height="14px" />
        <Typography className={classnames(classes.actionName, classes.dialogTitle)}>
          {label}
        </Typography>
        <Typography className={classes.dialogTitle}>
          parameters
        </Typography>
      </DialogTitle>
      {description
        && (
          <DialogContent className={classes.descriptionContainer} dividers>
            <Typography className={classes.descriptionTypography} gutterBottom>
              {description}
            </Typography>
          </DialogContent>
        )}
      <DialogContent data-test="action-argument-inputs" className={classes.formContainer}>
        {Array.isArray(elementList) && elementList.map(
          (argName, ix) => elementValues[argName] && elementValues[argName].input && (
            <div key={argName} className={classes.inputContainer}>
              {elementValues[argName]?.type === ACTION_ARGUMENT_TYPES.STRING && (
                <ActionParametersDialogTextInput
                  actionArgument={elementValues[argName]}
                  name={argName}
                  label={getArgName(argName, ix)}
                  handleChangeForm={handleChangeForm}
                  value={values[argName]}
                  error={errors[argName]}
                  attributeValues={attributeValues}
                />
              )}
              {elementValues[argName]?.type === ACTION_ARGUMENT_TYPES.NUMBER && (
                <ActionParametersDialogNumberInput
                  actionArgument={elementValues[argName]}
                  label={getArgName(argName, ix)}
                  name={argName}
                  handleChangeForm={handleChangeForm}
                  value={values[argName]}
                  error={errors[argName]}
                />
              )}
            </div>
          )
        )}
      </DialogContent>
      <DialogContent className={classes.buttonContainer}>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button
            variant="contained"
            data-test="actions-arguments-dialog-submit-button"
            onClick={handleSubmit}
            color="primary"
            disabled={!isEmpty(errors)}
          >
            Submit
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

ActionParametersDialog.propTypes = {
  handleClose: PropTypes.func,
  open: PropTypes.bool,
  actionArguments: PropTypes.shape({
    elementList: PropTypes.arrayOf(PropTypes.string),
    elementValues: PropTypes.object,
    label: PropTypes.string,
    description: PropTypes.string
  }),
  attributeValues: PropTypes.object,
  saveChanges: PropTypes.func
};

export default ActionParametersDialog;
