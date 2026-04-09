import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import PropTypes from 'prop-types';

const Bar0 = () => (
  <SvgIcon
    width="18"
    height="10"
    viewBox="0 0 18 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect y="0.1875" width="2.22078" height="9.62338" fill="#3F93FF" />
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
    <rect y="0.1875" width="2.22078" height="9.62338" fill="#3F93FF" />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
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
    <rect y="0.1875" width="2.22078" height="9.62338" fill="#3F93FF" />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
    />
    <rect
      x="7.40259"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
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
    <rect y="0.1875" width="2.22078" height="9.62338" fill="#3F93FF" />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
    />
    <rect
      x="7.40259"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
    />
    <rect
      x="11.104"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
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
    <rect y="0.1875" width="2.22078" height="9.62338" fill="#3F93FF" />
    <rect
      x="3.70142"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
    />
    <rect
      x="7.40259"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
    />
    <rect
      x="11.104"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
    />
    <rect
      x="14.8052"
      y="0.1875"
      width="2.22078"
      height="9.62338"
      fill="#3F93FF"
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
