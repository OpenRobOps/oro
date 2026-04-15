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
        fill="#FFFFFF"
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
