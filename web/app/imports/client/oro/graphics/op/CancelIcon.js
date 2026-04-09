import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import PropTypes from 'prop-types';

// This icon is used on ActiveInteractionControl to cancel interactions
const CancelNavIcon = (props) => {
  const { classes } = props;
  return (
    <SvgIcon
      classes={{ root: classes }}
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.2001 23.6533L11.7422 25.1953L25.2001 11.7374L23.658 10.1954L10.2001 23.6533Z"
        fill="black"
      />
      <path
        d="M23.6557 25.1983L25.1978 23.6562L11.7399 10.1984L10.1978 11.7404L23.6557 25.1983Z"
        fill="black"
      />
      <defs>
        <clipPath id="clip0">
          <rect
            width="15"
            height="15"
            fill="white"
            transform="translate(10.2002 10.1992)"
          />
        </clipPath>
      </defs>
    </SvgIcon>
  );
};

CancelNavIcon.propTypes = {
  classes: PropTypes.string
};

export default CancelNavIcon;
