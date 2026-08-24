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
 * DiagnosticsWarningIcon used in ROS Diagnostics widget
 * Represents the warning level
 */
import * as React from 'react';
import theme from '../../../Styles';

const DiagnosticsWarningIcon = props => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={18}
    height={18}
    fill="none"
    {...props}
  >
    <circle cx={9} cy={9} r={9} fill={theme.palette.diagnostics.warning} />
    <path
      fill={theme.palette.getContrastText(theme.palette.diagnostics.warning)}
      d="M9.747 11.656H7.99l-.249-7.39h2.256l-.249 7.39Zm-.879 1.157c.357 0 .642.105.857.315.22.21.33.478.33.806 0 .322-.11.588-.33.798-.215.21-.5.315-.857.315-.351 0-.637-.105-.857-.315a1.069 1.069 0 0 1-.322-.798c0-.323.107-.589.322-.799.22-.215.506-.322.857-.322Z"
    />
  </svg>
);

export default DiagnosticsWarningIcon;
