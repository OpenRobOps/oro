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
import SvgIcon from '@mui/material/SvgIcon';

// Used on ActiveInteractionControl to zoom out the map
const ZoomOutIcon = () => {
  return (
    <SvgIcon
      width="36"
      height="36"
      viewBox="5 5 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24.792 19.28L24.792 16.7461L11.742 16.7461L11.742 19.28L24.792 19.28Z"
        fill="currentColor"
      />
      <defs>
        <clipPath id="clip0">
          <rect
            width="13.05"
            height="2.53387"
            fill="white"
            transform="translate(11.7422 16.7461)"
          />
        </clipPath>
      </defs>
    </SvgIcon>
  );
};

export default ZoomOutIcon;
