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

// Used on ActiveInteractionControl to confirm an interaction (relocalize, teleop, etc.)
import React from 'react';
import PropTypes from 'prop-types';
import SvgIcon from '@mui/material/SvgIcon';

const ConfirmIcon = (props) => {
  const { classes = {} } = props;
  return (
    <SvgIcon
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className={classes.checkmark}
        d="M11.0001 16.7634L8.85303 18.9492L14.9102 25.1156L17.0572 22.9298L11.0001 16.7634Z"
      />
      <path
        className={classes.checkmark}
        d="M12.7664 22.9251L14.915 25.1094L27.2963 12.5231L25.1476 10.3388L12.7664 22.9251Z"
      />
      <defs>
        <clipPath id="clip0">
          <rect
            width="18.4437"
            height="14.7702"
            transform="translate(8.85303 10.3398)"
          />
        </clipPath>
      </defs>
    </SvgIcon>
  );
};

ConfirmIcon.propTypes = {
  classes: PropTypes.shape({
    checkmark: PropTypes.string,
  }),
};

export default ConfirmIcon;
