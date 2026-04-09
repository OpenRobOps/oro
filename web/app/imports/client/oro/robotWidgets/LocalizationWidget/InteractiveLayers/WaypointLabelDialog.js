/**
 * WaypointLabelDialog
 *
 * Dialog to input a string from user.
 *
 * Note: It's generic, not limited to waypoints
*/
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  TextField
} from '@mui/material';

const WaypointLabelDialog = ({
  open, title, value, onClose, onSubmit
}) => {
  const [editValue, setEditValue] = useState('');
  const [openState, setOpenState] = useState(false);

  useEffect(() => {
    if (open != openState) {
      // Dialog is opening/closing. Discard the internal state and replace by the value in props
      setOpenState(open);
      setEditValue(value);
    }
  }, [open, openState]);

  const handleSubmit = () => {
    onSubmit(editValue);
  };

  return (
    <Dialog onClose={onClose} open={open} disablePortal>
      <DialogTitle>
        {title}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="waypoint name"
          margin="normal"
          onChange={event => setEditValue(event.target.value)}
          value={editValue}
        />
        <DialogActions>
          <Button onClick={onClose} color="primary">
            Cancel
          </Button>
          <Button
            variant="contained"
            data-test="actions-arguments-dialog-submit-button"
            onClick={handleSubmit}
            color="primary"
          >
            Accept
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

WaypointLabelDialog.propTypes = {
  open: PropTypes.bool,
  onSubmit: PropTypes.func,
  onClose: PropTypes.func,
  title: PropTypes.string,
  value: PropTypes.string
};

export default WaypointLabelDialog;
