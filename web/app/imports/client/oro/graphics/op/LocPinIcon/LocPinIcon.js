// Used on ActiveInteractionControl for the Waypoint / Navigate button
import React from 'react';
import PropTypes from 'prop-types';
import SvgIcon from '@mui/material/SvgIcon';

const LocPinIcon = ({ disabled }) => {
  if (disabled) {
    return (
      <SvgIcon
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.1282 22L7.68705 7.96154H16.5694L12.1282 22Z"
          fill="rgba(255,255,255,0.3)"
        />
        <ellipse
          cx="12.1282"
          cy="6.67949"
          rx="4.61538"
          ry="4.67949"
          fill="rgba(255,255,255,0.3)"
        />
        <circle cx="12.0641" cy="6.67949" r="2.37179" fill="rgba(255,255,255,0.2)" />
      </SvgIcon>
    );
  }

  return (
    <SvgIcon
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0)">
        <path
          d="M23.0959 14.2222C23.0959 11.2468 20.8136 8.83203 18.0016 8.83203C15.1895 8.83203 12.9072 11.2468 12.9072 14.2222C12.9072 14.9251 13.0376 15.5935 13.2699 16.2058H13.2659L13.2822 16.2403C13.3596 16.4473 13.4493 16.6457 13.5512 16.8354L18.2053 27.1716L22.6395 16.443C22.668 16.3783 22.6965 16.3093 22.721 16.2446L22.7373 16.2015H22.7332C22.9655 15.5892 23.0959 14.9208 23.0959 14.2222ZM18.0016 17.6676C16.4366 17.6676 15.1691 16.3266 15.1691 14.6707C15.1691 13.0148 16.4366 11.6737 18.0016 11.6737C19.5665 11.6737 20.834 13.0148 20.834 14.6707C20.834 16.3266 19.5665 17.6676 18.0016 17.6676Z"
          fill="#FFFFFF"
        />
      </g>
      <defs>
        <clipPath id="clip0">
          <rect
            width="10.1887"
            height="18.3396"
            fill="white"
            transform="translate(12.9072 8.83203)"
          />
        </clipPath>
      </defs>
    </SvgIcon>
  );
};

LocPinIcon.propTypes = {
  disabled: PropTypes.bool,
};

export default LocPinIcon;
