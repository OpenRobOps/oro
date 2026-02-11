/**
 * Wraps component with a Custom HTML Tooltip (https://material-ui.com/components/tooltips/)
 * If msg exists it wraps the component with the tooltip
 * If msg does not exist, the component is render as it is received
 * @param {string} msg Message to display as tooltip
 * @param {Component} component Component to render
 * @param {Object} options Options applied to the wrapper.
 *   - withoutDivWrapper: if true the component will not be wrapped in a div,
 *                        because if the component is not disableable then it is not necessary
 *                        More info: https://mui.com/components/tooltips/#disabled-elements
 */

import React from 'react';
import { Tooltip } from '@mui/material';

function WrapWithTooltip(msg, component, options = {}) {
  const { withoutDivWrapper = false, placement } = options;
  return msg ? (
    <Tooltip title={msg} disableInteractive placement={placement}>
      {withoutDivWrapper ? (
        component
      ) : (
        <div>
          {component}
        </div>
      )}
    </Tooltip>
  ) : component;
}

export default WrapWithTooltip;
