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

// Used on ActiveInteractionControl for the Open Teleop button
import React from 'react';
import PropTypes from 'prop-types';
import SvgIcon from '@mui/material/SvgIcon';

const RetroPadIcon = ({ disabled }) => {
  if (disabled) {
    return (
      <SvgIcon
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M17.41 13H6.91L4.41 17H20.41L17.41 13Z" stroke="currentColor" strokeOpacity="0.3" />
        <path d="M4 17.5V20.5H20.9V17.5" stroke="currentColor" strokeOpacity="0.3" />
        <line
          x1="12.41"
          y1="6"
          x2="12.41"
          y2="15"
          stroke="currentColor" strokeOpacity="0.3"
          strokeWidth="2"
        />
      </SvgIcon>
    );
  }

  return (
    <SvgIcon
      width="36"
      height="36"
      viewBox="8 8 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M25.4454 25.152H10.5544C10.3932 25.152 10.2856 25.0485 10.2856 24.8933V21.8407C10.2856 21.6855 10.3932 21.582 10.5544 21.582H25.4454C25.6067 21.582 25.7142 21.6855 25.7142 21.8407V24.8933C25.7142 25.0485 25.6067 25.152 25.4454 25.152ZM10.8232 24.6346H25.1766V22.0994H10.8232V24.6346Z"
        fill="currentColor"
      />
      <path
        d="M10.662 22.0982C10.5545 22.0982 10.447 22.0465 10.3932 21.943C10.3395 21.8395 10.3395 21.736 10.447 21.6843L13.2424 18.373C13.2962 18.3213 13.3499 18.2695 13.4574 18.2695H22.1125C22.1662 18.2695 22.2738 18.3213 22.3275 18.373L25.553 21.6326C25.6068 21.6843 25.6605 21.8395 25.6068 21.8913C25.553 21.9947 25.4455 22.0465 25.338 22.0465L10.662 22.0982ZM13.6187 18.7869L11.2534 21.5808L24.7466 21.5291L22.0587 18.7869H13.6187Z"
        fill="currentColor"
      />
      <path
        d="M18.8867 15.9414H17.2202V20.2357H18.8867V15.9414Z"
        fill="currentColor"
      />
      <path
        d="M18.0806 16.8727C19.9213 16.8727 21.4136 15.4365 21.4136 13.6648C21.4136 11.8932 19.9213 10.457 18.0806 10.457C16.2398 10.457 14.7476 11.8932 14.7476 13.6648C14.7476 15.4365 16.2398 16.8727 18.0806 16.8727Z"
        fill="currentColor"
      />
      <defs>
        <clipPath id="clip0">
          <rect
            width="15.4286"
            height="14.6939"
            fill="white"
            transform="translate(10.2856 10.457)"
          />
        </clipPath>
      </defs>
    </SvgIcon>
  );
};

RetroPadIcon.propTypes = {
  disabled: PropTypes.bool,
};

export default RetroPadIcon;
