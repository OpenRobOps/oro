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

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import CustomSnackbar, { SnackbarVariants } from './CustomSnackbar';

// TODO: Make this wrapper work on fullscreen mode check withActionsContext Portal
//       component to get an idea on how to fix it
/**
 * Wraps component with a Snackbar handler
 * @param {object} props Wrapped component props
 * @param {Component} WrappedComponent Component to render and wrap the snackbar
 */
const WithSnackbar = (props, WrappedComponent) => {
  const [statusMessage, setStatusMessage] = useState({ open: false });
  const navigate = useNavigate();

  /**
   * Shows a quick informational message telling if an action was or was not executed.
   */
  const showSnackbar = useCallback((message, variant = SnackbarVariants.ERROR, action) => {
    const snackbarAction = action && SNACKBAR_ACTIONS[action]
      ? SNACKBAR_ACTIONS[action](navigate) : {};
    setStatusMessage({
      open: true,
      message,
      variant,
      snackbarAction
    });
  }, []);

  const handleCloseSnackbar = useCallback(() => setStatusMessage({ open: false }), []);

  return (
    <>
      <WrappedComponent
        {...props}
        onFeedback={showSnackbar}
      />
      {statusMessage.open && (
        <CustomSnackbar
          open={statusMessage.open}
          variant={statusMessage.variant}
          message={statusMessage.message}
          onClose={handleCloseSnackbar}
          autoHideDuration={2000}
          {...statusMessage.snackbarAction}
        />
      )}
    </>
  );
};

WithSnackbar.propTypes = {
  props: PropTypes.object,
  WrappedComponent: PropTypes.element
};

// Make it possible to compose a WithSnackbar HOC and another component with a functional style:
//  const SomeComponentWithSnackbar = componentWithSnackbar(SomeComponent)
const componentWithSnackbar = child => props => WithSnackbar(props, child);

export default WithSnackbar;
export { componentWithSnackbar };
