import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';

// Used on ActiveInteractionControl to zoom in the map
const ZoomInIcon = () => {
  return (
    <SvgIcon
      width="36"
      height="36"
      viewBox="5 5 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24.3418 19.0729L24.3418 16.5391L11.2918 16.5391L11.2918 19.0729L24.3418 19.0729Z"
        fill="#FFFFFF"
      />
      <path
        d="M19.0837 11.2812H16.5498V24.3312H19.0837V11.2812Z"
        fill="#FFFFFF"
      />
      <defs>
        <clipPath id="clip0">
          <rect
            width="13.05"
            height="13.05"
            fill="white"
            transform="translate(11.292 11.2812)"
          />
        </clipPath>
      </defs>
    </SvgIcon>
  );
};

export default ZoomInIcon;
