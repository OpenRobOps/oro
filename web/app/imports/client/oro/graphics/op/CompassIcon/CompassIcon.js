import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';

// Used on ActiveInteractionControl to reset map zoom/position
const CompassIcon = () => {
  return (
    <SvgIcon
      width="36"
      height="36"
      viewBox="11 5 14 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0)">
        <path
          d="M17.8579 7.64844L13.9502 17.3861H22.0502L17.8579 7.64844Z"
          fill="#FFFFFF"
        />
        <path
          d="M17.8579 27.8978L13.9502 18.1602H22.0502L17.8579 27.8978Z"
          fill="rgba(255,255,255,0.6)"
        />
      </g>
      <defs>
        <clipPath id="clip0">
          <rect
            width="8.1"
            height="20.25"
            fill="white"
            transform="translate(13.9502 7.64844)"
          />
        </clipPath>
      </defs>
    </SvgIcon>
  );
};

export default CompassIcon;
