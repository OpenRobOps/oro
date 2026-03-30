/**
 * Custom control to show a notification skackbar
 * (with different modes: success, info, error, warning).
 * Example directly following customized snackbards from MUI: https://material-ui.com/demos/snackbars/
 *
 * Colors picked from https://www.materialui.co/colors combined with those in the tutorial
 * page.
 */
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, IconButton, Snackbar } from '@mui/material';
import { withStyles } from 'tss-react/mui';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';

const SNACKBAR_DEFAULT_DURATION = 5000;

// Constants to export, received as strings in `variant` prop
const SnackbarVariants = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  INFO: 'info'
};

const VariantIcons = {
  success: CheckCircleIcon,
  warning: WarningIcon,
  error: ErrorIcon,
  info: InfoIcon
};

const styles1 = theme => ({
  success: {
    backgroundColor: theme.palette.snackbar.success,
  },
  error: {
    backgroundColor: theme.palette.snackbar.error,
  },
  info: {
    backgroundColor: theme.palette.snackbar.info,
  },
  warning: {
    backgroundColor: theme.palette.snackbar.warning,
  },
  icon: {
    fontSize: 20,
  },
  iconVariant: {
    opacity: 0.9,
    marginRight: theme.spacing(1),
  },
  message: {
    display: 'flex',
    alignItems: 'center',
  }
});

// Snackbar anchor (different from mui5's default)
const SNACKBAR_ANCHOR_ORIGIN = { vertical: 'bottom', horizontal: 'center' };

function CustomSnackbarContent(props) {
  const {
    classes, open, className, message, onClose, variant,
    actionMessage, onAction, autoHideDuration, actionColor = 'inherit'
  } = props;
  const Icon = VariantIcons[variant];
  return (
    <Snackbar
      key={message}
      open={open}
      anchorOrigin={SNACKBAR_ANCHOR_ORIGIN}
      ContentProps={{
        classes: {
          root: classNames(classes[variant], className)
        }
      }}
      aria-describedby="client-snackbar"
      message={(
        <span className={classes.message} data-test="snackbar-message">
          {Icon && <Icon className={classNames(classes.icon, classes.iconVariant)} />}
          {message}
        </span>
      )}
      action={[
        actionMessage && onAction && (
          <Button key="action" color={actionColor} onClick={onAction} data-test="snackbar-action">
            { actionMessage }
          </Button>
        ),
        <IconButton
          key="close"
          aria-label="Close"
          color="inherit"
          className={classes.close}
          onClick={onClose}
          size="large"
        >
          <CloseIcon className={classes.icon} />
        </IconButton>,
      ]}
      onClose={onClose}
      autoHideDuration={autoHideDuration || null}
    />
  );
}

CustomSnackbarContent.propTypes = {
  classes: PropTypes.object.isRequired,
  className: PropTypes.string,
  message: PropTypes.node,
  onClose: PropTypes.func,
  variant: PropTypes.oneOf(['success', 'warning', 'error', 'info']).isRequired,
  autoHideDuration: PropTypes.number,
  actionMessage: PropTypes.string,
  onAction: PropTypes.func,
  open: PropTypes.bool,
  actionColor: PropTypes.string
};

const CustomSnackbarContentWrapper = withStyles(CustomSnackbarContent, styles1);

export default CustomSnackbarContentWrapper;
export {
  SnackbarVariants,
  SNACKBAR_DEFAULT_DURATION
};
