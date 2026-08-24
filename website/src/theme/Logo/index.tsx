import React, {type ReactNode, type ComponentProps} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useThemeConfig} from '@docusaurus/theme-common';

/**
 * Theme-aware ORO lockup: ink and wedge come from the active palette's CSS
 * vars (see src/css/custom.css), so Monokai gets its green wedge, Rosé Pine
 * its rose, and Dawn a dark ink — no per-theme image files. Geometry is
 * byte-identical to static/img/full-logo-small-size.svg.
 *
 * Swizzled (wrapped) from @docusaurus/theme-classic Logo; keeps the config's
 * navbar.logo href/alt and the navbar title, drops src/srcDark.
 */

const INK = [
  'M9.30616 21.6969L0.805304 13.2001C0.289621 12.6833 0 11.9831 0 11.2531C0 10.5231 0.289621 9.82288 0.805304 9.30616L9.30616 0.805304C9.82288 0.289621 10.5231 0 11.2531 0C11.9831 0 12.6833 0.289621 13.2001 0.805304L21.6969 9.30616L19.0329 11.9702L11.2531 4.19042L4.19042 11.2531L11.9702 19.0329L9.30616 21.6969Z',
  'M41.4708 21.6969L32.974 13.2001C32.4583 12.6833 32.1687 11.9831 32.1687 11.2531C32.1687 10.5231 32.4583 9.82288 32.974 9.30616L41.4708 0.805304C41.9875 0.289621 42.6877 0 43.4178 0C44.1478 0 44.848 0.289621 45.3647 0.805304L53.8616 9.30216L51.1975 11.9662L43.4178 4.19042L36.3551 11.2531L44.1349 19.0329L41.4708 21.6969Z',
  'M33.014 1.20593H28.5433C27.9332 1.20593 27.3292 1.32635 26.7658 1.56028C26.2024 1.79421 25.6907 2.13706 25.2601 2.56916C24.8295 3.00126 24.4884 3.51411 24.2565 4.0783C24.0245 4.6425 23.9061 5.24694 23.9082 5.85697V21.8812H27.9143V5.26006H33.014V1.20593Z',
];
const ACCENT = [
  'M19.0711 11.9073L11.6437 19.3347L14.3065 21.9975L21.7338 14.5701L19.0711 11.9073Z',
  'M51.2373 11.9099L43.8099 19.3373L46.4726 22L53.9 14.5727L51.2373 11.9099Z',
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
      viewBox="0 0 54 22"
      fill="none"
      role={logo?.alt ? 'img' : 'presentation'}
      aria-label={logo?.alt || undefined}>
      {INK.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="var(--oro-color-cream)" />
      ))}
      {ACCENT.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="var(--oro-color-accent)" />
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
