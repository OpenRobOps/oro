import React from 'react';
import { Button } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import PropTypes from 'prop-types';

function ConfirmationDialog(props) {
  const {
    open, title, content, confirmButtonText
  } = props;
  return (
    <React.Fragment>
      <Dialog open={open} onClose={() => props.onDone(false)} data-test="delete-dialog-container">
        { title && <DialogTitle>{title}</DialogTitle> }
        <DialogContent>
          <DialogContentText>
            {content}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => props.onDone(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={() => props.onDone(true)} color="primary" data-test="confirm-delete">
            {confirmButtonText || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

ConfirmationDialog.propTypes = {
  content: PropTypes.string,
  onDone: PropTypes.func,
  open: PropTypes.bool,
  title: PropTypes.string,
  confirmButtonText: PropTypes.string,
};

export default ConfirmationDialog;
