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
