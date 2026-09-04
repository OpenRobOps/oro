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
 * There is no light or dark variant of the mark — there is the mark, and
 * whatever palette is mounted. Ink follows text.primary; the wedge follows
 * secondary.main (the graphic accent, deliberately NOT background.accentSolid,
 * which exists only for fills that carry text). Both can be overridden per call
 * site via `ink` / `accent`.
 *
 * Geometry is byte-identical to website/static/img/full-logo-small-size.svg
 * (the 2026 golden-brand lockup; the mark matches the oro-icon asset).
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

const VIEWBOX = { full: '0 0 327 133', mark: '-16 -16 164.444 165' };
const ASPECT = { full: 327 / 133, mark: 164.444 / 165 };

// Full lockup: two brackets + the R (with its wedge notch).
const FULL_INK = [
  'M251.028 132.444L199.136 80.5769C195.988 77.4227 194.22 73.1484 194.22 68.6922C194.22 64.2359 195.988 59.9617 199.136 56.8075L251.028 4.91581C254.182 1.76793 258.456 0 262.913 0C267.369 0 271.643 1.76793 274.797 4.91581L326.664 56.8075L310.402 73.0695L262.913 25.5795L219.8 68.6922L267.29 116.182L251.028 132.444Z',
  'M56.8075 132.444L4.91581 80.5769C1.76793 77.4227 0 73.1484 0 68.6922C0 64.2359 1.76793 59.9617 4.91581 56.8075L56.8075 4.91581C59.9617 1.76793 64.2359 0 68.6922 0C73.1484 0 77.4227 1.76793 80.5769 4.91581L132.444 56.8075L116.182 73.0695L68.6922 25.5795L25.5795 68.6922L73.0695 116.182L56.8075 132.444Z',
  'M204.716 6.23633H177.425C173.701 6.23631 170.014 6.97137 166.575 8.39936C163.136 9.82735 160.012 11.9202 157.384 14.5578C154.755 17.1955 152.673 20.3261 151.257 23.7701C149.841 27.2141 149.118 30.9038 149.131 34.6276V132.444H173.585V30.9839H204.716V6.23633Z',
];
const FULL_ACCENT = [
  'M310.396 73.0513L267.271 116.176L283.462 132.368L326.587 89.2427L310.396 73.0513Z',
  'M116.175 73.0513L73.0505 116.176L89.2419 132.368L132.367 89.2427L116.175 73.0513Z',
  'M184.716 6.23633H204.716V30.9839H184.716Z',
];

// Single bracket with 16-unit padding — the app-icon / collapsed-nav form.
const MARK_INK = [
  'M56.8075 132.444L4.91581 80.5769C1.76793 77.4227 0 73.1484 0 68.6922C0 64.2359 1.76793 59.9617 4.91581 56.8075L56.8075 4.91581C59.9617 1.76793 64.2359 0 68.6922 0C73.1484 0 77.4227 1.76793 80.5769 4.91581L132.444 56.8075L116.182 73.0695L68.6922 25.5795L25.5795 68.6922L73.0695 116.182L56.8075 132.444Z',
];
const MARK_ACCENT = [
  'M116.175 73.0513L73.0505 116.176L89.2419 132.368L132.367 89.2427L116.175 73.0513Z',
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
  /** Rendered height in px; width is derived (lockup 327:133, mark ~1:1). */
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
