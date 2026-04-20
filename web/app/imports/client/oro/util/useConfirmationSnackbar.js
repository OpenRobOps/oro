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
 * Hook to wrap the rendering of an information/confirmation snackbar and its state, providing
 * convenient functions to open and close it.
 *
 * It helps keeping code that requires confirmations cleaner, without need of maintaining states,
 * and combines the declarative nature of react hooks with a more convenient and procedural
 * (functions-oriented) way to cause effects, such as opening and closing the dialog.
 *
 * Usage:
 * ```
 * const { openDialog, closeDialog, ConfirmationDialog } = useConfirmationSnackbar()
 * ```
 * then, include `{ ConfirmationDialog }` in rendering code. Invoke openDialog() or closeDialog()
 * at any time. Arguments to openDialog are (options, callback) where `options` take the same
 * properties as CustomSnackbar props, and callback is a single function to be called whenever
 * the snackbar closes (either pressing "X", pressing the action message (normally a "Yes") or
 * by a timeout.
 */
import React, { useCallback, useState } from 'react';
import CustomSnackbar, { SNACKBAR_DEFAULT_DURATION, SnackbarVariants } from './CustomSnackbar';

const INITIAL_SNACKBAR_STATE = {
  open: false,
  variant: SnackbarVariants.SUCCESS,
  message: '',
  autoHideDuration: SNACKBAR_DEFAULT_DURATION,
  actionMessage: '',
  onClose: null,
  onAction: null,
};

const useConfirmationSnackbar = () => {
  // The snackbar state are all the props required to use a CustomSnackbar.
  const [snackbar, setSnackbar] = useState(INITIAL_SNACKBAR_STATE);

  const closeDialog = useCallback(() => {
    setSnackbar(INITIAL_SNACKBAR_STATE);
  }, []);

  const openDialog = useCallback((options, callback) => {
    if (!options || !options.message) {
      throw new Error('options.message is required to open a confirmation snackbar');
    }
    const {
      message,
      autoHideDuration = SNACKBAR_DEFAULT_DURATION,
      variant = SnackbarVariants.SUCCESS,
      actionMessage = ''
    } = options || {};
    setSnackbar({
      open: true,
      message,
      variant,
      actionMessage,
      autoHideDuration,
      onClose: () => {
        closeDialog();
        callback && callback(false);
      },
      onAction: () => {
        closeDialog();
        callback && callback(true);
      }
    });
  }, []); // closeDialog is a dependency but it never changes - avoid it as dep

  const ConfirmationDialog = (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <CustomSnackbar {...snackbar} />
  );
  return { openDialog, closeDialog, ConfirmationDialog };
};

export default useConfirmationSnackbar;
export {
  SnackbarVariants
};
