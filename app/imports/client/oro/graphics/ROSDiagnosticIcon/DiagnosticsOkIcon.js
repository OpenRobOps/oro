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
 * DiagnosticsOkIcon used in ROS Diagnostics widget
 * Represents the OK level
 */
import * as React from 'react';

const DiagnosticsOkIcon = props => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={18}
    height={18}
    fill="none"
    {...props}
  >
    <circle cx={9} cy={9} r={9} fill="#3F93FF" />
    <path
      fill="#fff"
      d="m5.711 8.533-1.09 1.065L7.696 12.6l1.09-1.065-3.075-3.003Z"
    />
    <path
      fill="#fff"
      d="m6.61 11.537 1.09 1.065 6.28-6.134-1.09-1.065-6.28 6.134Z"
    />
  </svg>
);

export default DiagnosticsOkIcon;
