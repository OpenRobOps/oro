/**
 * Plus icon - used in Zone selector to create a new zone
 */
import React from 'react';

const PlusIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={16}
    height={16}
    fill="none"
    {...props}
  >
    <g clipPath="url(#colorchip_svg__a)">
      <path
        fill="#666"
        d="M12.667 8.667h-4v4H7.334v-4h-4V7.333h4v-4h1.333v4h4v1.334Z"
      />
    </g>
    <defs>
      <clipPath id="colorchip_svg__a">
        <path fill="#fff" d="M0 0h16v16H0z" />
      </clipPath>
    </defs>
  </svg>
);

export default PlusIcon;
