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
