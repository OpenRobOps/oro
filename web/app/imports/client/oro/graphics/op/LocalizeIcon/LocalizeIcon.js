// Used on ActiveInteractionControl for the Relocalize button
import React from 'react';
import PropTypes from 'prop-types';
import SvgIcon from '@mui/material/SvgIcon';

const LocalizeIcon = ({ disabled }) => {
  if (disabled) {
    return (
      <SvgIcon
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="8" cy="12" r="5.5" stroke="rgba(255,255,255,0.3)" />
        <circle cx="16" cy="12" r="5.5" fill="none" stroke="rgba(255,255,255,0.3)" />
        <path d="M19 12L13 15.0311V8.96891L19 12Z" fill="rgba(255,255,255,0.3)" />
        <line x1="6" y1="12" x2="16" y2="12" stroke="rgba(255,255,255,0.3)" />
      </SvgIcon>
    );
  }

  return (
    <SvgIcon
      width="36"
      height="36"
      viewBox="8 7 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14.8625 22.8568C17.6038 22.8568 19.8261 20.6346 19.8261 17.8933C19.8261 15.152 17.6038 12.9297 14.8625 12.9297C12.1212 12.9297 9.89893 15.152 9.89893 17.8933C9.89893 20.6346 12.1212 22.8568 14.8625 22.8568Z"
        fill="none"
        stroke="#FFFFFF"
        strokeMiterlimit="10"
      />
      <path
        d="M22.4875 22.8568C25.2288 22.8568 27.4511 20.6346 27.4511 17.8933C27.4511 15.152 25.2288 12.9297 22.4875 12.9297C19.7462 12.9297 17.5239 15.152 17.5239 17.8933C17.5239 20.6346 19.7462 22.8568 22.4875 22.8568Z"
        fill="none"
        stroke="#FFFFFF"
        strokeMiterlimit="10"
      />
      <path
        d="M12.3716 17.8594H21.3215"
        stroke="#FFFFFF"
        strokeMiterlimit="10"
      />
      <path
        d="M24.8575 17.8607L19.3892 15.2656V20.488L24.8575 17.8607Z"
        fill="#FFFFFF"
      />
    </SvgIcon>
  );
};

LocalizeIcon.propTypes = {
  disabled: PropTypes.bool,
};

export default LocalizeIcon;
