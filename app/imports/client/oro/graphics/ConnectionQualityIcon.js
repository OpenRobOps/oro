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
import PropTypes from 'prop-types';
import theme from '../../Styles';

// Function, not a const: reads the active theme at render time (hot theme switch)
const barFill = () => theme.palette.incidents.ok;

const Bar0 = () => (
  <SvgIcon
    width="18"
    height="10"
    viewBox="0 0 18 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="0.1875" width="2.22078" height="9.62338" fill={barFill()} />
  </SvgIcon>
);

const Bar1 = () => (
  <SvgIcon
    width="18"
    height="10"
    viewBox="0 0 18 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="0.1875" width="2.22078" height="9.62338" fill={barFill()} />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
  </SvgIcon>
);

const Bar2 = () => (
  <SvgIcon
    width="18"
    height="10"
    viewBox="0 0 18 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="0.1875" width="2.22078" height="9.62338" fill={barFill()} />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
    <rect
      x="7.40259"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
  </SvgIcon>
);

const Bar3 = () => (
  <SvgIcon
    width="18"
    height="10"
    viewBox="0 0 18 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="0.1875" width="2.22078" height="9.62338" fill={barFill()} />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
    <rect
      x="7.40259"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
    <rect
      x="11.104"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
  </SvgIcon>
);

const Bar4 = () => (
  <SvgIcon
    width="18"
    height="10"
    viewBox="0 0 18 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="0.1875" width="2.22078" height="9.62338" fill={barFill()} />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
    <rect
      x="7.40259"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
    <rect
      x="11.104"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
    <rect
      x="14.8052"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill={barFill()}
    />
  </SvgIcon>
);

const ConnectionQualityIcon = (props) => {
  if (props.barNumber == 4) {
    return Bar4();
  }
  if (props.barNumber == 3) {
    return Bar3();
  }
  if (props.barNumber == 2) {
    return Bar2();
  }
  if (props.barNumber == 1) {
    return Bar1();
  }
  return Bar0();
};

ConnectionQualityIcon.propTypes = {
  barNumber: PropTypes.number,
};

export default ConnectionQualityIcon;
