/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * OroLogo: the ORO lockup, drawn from the active theme.
 *
 * Replaces the /images/oro-logo.svg + /images/oro-logo-light.svg pair and the
 * `theme.palette.mode === 'light' ? … : …` switch at each call site. There is no
 * light or dark variant of the mark — there is the mark, and whatever palette is
 * mounted. Ink follows text.primary; the wedge follows secondary.main (the
 * graphic accent, deliberately NOT background.accentSolid, which exists only for
 * fills that carry text).
 *
 * Geometry is byte-identical to the shipped oro-logo.svg.
 *
 *   <OroLogo height={22} onClick={…} />   // header lockup
 *   <OroLogo height={44} title="ORO" />   // login, named for screen readers
 *   <OroLogo mark height={28} />          // bracket only, collapsed nav
 *   <OroLogo height={22} ink="currentColor" />  // inherit on a colored surface
 *
 * public/images/favicon.svg stays a static file — it can't read the theme.
 */
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';

const VIEWBOX = { full: '0 0 207 85', mark: '0 0 86 86' };
const ASPECT = { full: 207 / 85, mark: 1 };

// Full lockup: two brackets + the R.
const FULL_INK = [
  'M35.6381 83.0886L3.08392 50.5498C1.10911 48.571 0 45.8895 0 43.0939C0 40.2983 1.10911 37.6169 3.08392 35.6381L35.6381 3.08392C37.6169 1.10911 40.2983 0 43.0939 0C45.8895 0 48.571 1.10911 50.5498 3.08392L83.0886 35.6381L72.8866 45.84L43.0939 16.0473L16.0473 43.0939L45.84 72.8866L35.6381 83.0886Z',
  'M158.813 83.0886L126.274 50.5498C124.299 48.571 123.19 45.8896 123.19 43.094C123.19 40.2984 124.299 37.6169 126.274 35.6381L158.813 3.08398C160.792 1.10917 163.473 6.10352e-05 166.269 6.10352e-05C169.065 6.10352e-05 171.746 1.10917 173.725 3.08398L206.264 35.6228L196.062 45.8247L166.269 16.0473L139.222 43.094L169.015 72.8867L158.813 83.0886Z',
  'M126.428 4.61816H109.307C106.971 4.61815 104.658 5.07929 102.5 5.97514C100.342 6.87098 98.383 8.18392 96.734 9.83865C95.085 11.4934 93.7788 13.4574 92.8904 15.6179C92.002 17.7785 91.5489 20.0933 91.5569 22.4294V83.7944H106.898V20.1435H126.428V4.61816Z',
];
const FULL_ACCENT = [
  'M73.033 45.5995L44.5898 74.0427L54.7868 84.2397L83.23 55.7965L73.033 45.5995Z',
  'M196.214 45.6091L167.771 74.0523L177.968 84.2493L206.411 55.8061L196.214 45.6091Z',
];

// Single bracket, 8px inset in an 86 box — the app-icon / collapsed-nav form.
const MARK_INK = [
  'M35.6381 75.0886L11.0839 50.5498C9.10911 48.571 8 45.8895 8 43.0939C8 40.2983 9.10911 37.6169 11.0839 35.6381L35.6381 11.0839C37.6169 9.10911 40.2983 8 43.0939 8C45.8895 8 48.571 9.10911 50.5498 11.0839L75.0886 35.6381L64.8866 45.84L43.0939 24.0473L24.0473 43.0939L45.84 64.8866L35.6381 75.0886Z',
];
const MARK_ACCENT = [
  'M65.033 45.5995L44.5898 66.0427L54.7868 76.2397L75.23 55.7965L65.033 45.5995Z',
];

const OroLogo = ({
  height = 40,
  mark = false,
  ink,
  accent,
  title,
  ...rest
}) => {
  const theme = useTheme();
  const kind = mark ? 'mark' : 'full';
  const inkFill = ink || theme.palette.text.primary;
  const accentFill = accent || theme.palette.secondary.main;

  return (
    <svg
      height={height}
      width={Math.round(height * ASPECT[kind])}
      viewBox={VIEWBOX[kind]}
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {(mark ? MARK_INK : FULL_INK).map((d) => (
        <path key={d.slice(0, 24)} d={d} fill={inkFill} />
      ))}
      {(mark ? MARK_ACCENT : FULL_ACCENT).map((d) => (
        <path key={d.slice(0, 24)} d={d} fill={accentFill} />
      ))}
    </svg>
  );
};

OroLogo.propTypes = {
  /** Rendered height in px; width is derived (lockup 207:85, mark 1:1). */
  height: PropTypes.number,
  /** Bracket only, no wordmark. Use below ~96px of available width. */
  mark: PropTypes.bool,
  /** Override the ink. Pass 'currentColor' to inherit from a colored surface. */
  ink: PropTypes.string,
  /** Override the wedge. */
  accent: PropTypes.string,
  /** Accessible name. Omit inside a link or button that already names itself. */
  title: PropTypes.string,
};

export default OroLogo;
