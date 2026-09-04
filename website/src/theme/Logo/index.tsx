import React, {type ReactNode, type ComponentProps} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useThemeConfig} from '@docusaurus/theme-common';

/**
 * ORO lockup. The wedge is always the brand gold (theme-independent); the ink
 * follows --oro-color-cream so it stays legible on light themes such as Dawn.
 * Geometry is byte-identical to static/img/full-logo-small-size.svg.
 *
 * Swizzled (wrapped) from @docusaurus/theme-classic Logo; keeps the config's
 * navbar.logo href/alt and the navbar title, drops src/srcDark.
 */

const INK = [
  'M251.028 132.444L199.136 80.5769C195.988 77.4227 194.22 73.1484 194.22 68.6922C194.22 64.2359 195.988 59.9617 199.136 56.8075L251.028 4.91581C254.182 1.76793 258.456 0 262.913 0C267.369 0 271.643 1.76793 274.797 4.91581L326.664 56.8075L310.402 73.0695L262.913 25.5795L219.8 68.6922L267.29 116.182L251.028 132.444Z',
  'M56.8075 132.444L4.91581 80.5769C1.76793 77.4227 0 73.1484 0 68.6922C0 64.2359 1.76793 59.9617 4.91581 56.8075L56.8075 4.91581C59.9617 1.76793 64.2359 0 68.6922 0C73.1484 0 77.4227 1.76793 80.5769 4.91581L132.444 56.8075L116.182 73.0695L68.6922 25.5795L25.5795 68.6922L73.0695 116.182L56.8075 132.444Z',
  'M204.716 6.23633H177.425C173.701 6.23631 170.014 6.97137 166.575 8.39936C163.136 9.82735 160.012 11.9202 157.384 14.5578C154.755 17.1955 152.673 20.3261 151.257 23.7701C149.841 27.2141 149.118 30.9038 149.131 34.6276V132.444H173.585V30.9839H204.716V6.23633Z',
];
const BRAND_GOLD = '#E0A526';
const ACCENT = [
  'M310.396 73.0513L267.271 116.176L283.462 132.368L326.587 89.2427L310.396 73.0513Z',
  'M116.175 73.0513L73.0505 116.176L89.2419 132.368L132.367 89.2427L116.175 73.0513Z',
  'M184.716 6.23633H204.716V30.9839H184.716Z',
];

export default function Logo(props: ComponentProps<'a'> & {
  imageClassName?: string;
  titleClassName?: string;
}): ReactNode {
  const {
    navbar: {title: navbarTitle, logo},
  } = useThemeConfig();
  const {imageClassName, titleClassName, ...propsRest} = props;
  const logoLink = useBaseUrl(logo?.href || '/');

  const svg = (
    <svg
      width="54"
      height="22"
      viewBox="0 0 327 133"
      fill="none"
      role={logo?.alt ? 'img' : 'presentation'}
      aria-label={logo?.alt || undefined}>
      {INK.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="var(--oro-color-cream)" />
      ))}
      {ACCENT.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill={BRAND_GOLD} />
      ))}
    </svg>
  );

  return (
    <Link to={logoLink} {...propsRest}>
      {imageClassName ? <div className={imageClassName}>{svg}</div> : svg}
      {navbarTitle != null && <b className={titleClassName}>{navbarTitle}</b>}
    </Link>
  );
}
