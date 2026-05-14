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
 * DiagnosticsStaleIcon used in ROS Diagnostics widget
 * Represents the Stale level
 */
import * as React from 'react';

const DiagnosticsStaleIcon = props => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={18}
    height={18}
    fill="none"
    {...props}
  >
    <circle cx={9} cy={9} r={9} fill="#BCBCBC" />
    <path
      fill="#000"
      d="M9.545 10.393H8.05c.004-.352.031-.655.082-.909.055-.257.146-.49.275-.697.133-.207.309-.412.528-.615.183-.164.343-.32.48-.469.137-.148.244-.3.322-.457a1.2 1.2 0 0 0 .117-.533c0-.227-.035-.414-.105-.563a.714.714 0 0 0-.305-.345.982.982 0 0 0-.504-.117c-.168 0-.324.037-.468.11a.87.87 0 0 0-.358.329c-.09.148-.136.344-.14.586h-1.7c.012-.535.135-.977.37-1.324.238-.352.556-.612.955-.78a3.355 3.355 0 0 1 1.341-.257c.547 0 1.016.09 1.407.27.39.175.69.435.896.778.207.34.31.754.31 1.243 0 .34-.066.642-.199.908a3.106 3.106 0 0 1-.521.732c-.215.227-.451.461-.709.703a1.62 1.62 0 0 0-.457.627c-.078.219-.12.479-.123.78Zm-1.67 1.81c0-.25.086-.457.258-.621.172-.168.402-.252.691-.252.285 0 .514.084.686.252a.813.813 0 0 1 .263.621.819.819 0 0 1-.263.615c-.172.168-.4.252-.686.252-.289 0-.52-.084-.691-.252a.828.828 0 0 1-.258-.615Z"
    />
  </svg>
);

export default DiagnosticsStaleIcon;
