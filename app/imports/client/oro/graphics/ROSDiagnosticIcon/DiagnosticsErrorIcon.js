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
 * DiagnosticsErrorIcon used in ROS Diagnostics widget
 * Represents the error level
 */
import * as React from 'react';

const DiagnosticsErrorIcon = props => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={18}
    height={18}
    fill="none"
    {...props}
  >
    <circle cx={9} cy={9} r={9} fill="#CB3303" />
    <g clipPath="url(#errorIcon_svg__a)">
      <path fill="#fff" d="M3.61 10.185v-2.4h10.8v2.4H3.61Z" />
    </g>
    <defs>
      <clipPath id="errorIcon_svg__a">
        <path fill="#fff" d="M3.602 10.2h10.8V7.8h-10.8z" />
      </clipPath>
    </defs>
  </svg>
);

export default DiagnosticsErrorIcon;
