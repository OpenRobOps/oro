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
 * Tokyo Day theme tokens (light).
 *
 * Based on the canonical Tokyo Night Day palette (folke/tokyonight.nvim, day style):
 *   bg #e1e2e7, fg #3760bf, comment #848cb5, blue #2e7de9, cyan #007197,
 *   magenta #9854f1, green #587539, orange #b15c00, red #f52a65, yellow #8c6c3e
 *
 * The ORO base is dark, so every token that assumes a dark background is
 * overridden here with a dark-on-light equivalent. Any token not overridden
 * inherits from the default ORO theme.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Base Tokyo Night Day colors
const BG = '#e1e2e7';
const BG_DARK = '#d0d5e3';
const BG_DARK1 = '#c1c9df';
const BG_HIGHLIGHT = '#c4c8da';
const PAPER = '#eff0f4';
const FG = '#3760bf';
const FG_DARK = '#6172b0';
const FG_GUTTER = '#a8aecb';
const COMMENT = '#848cb5';
const DARK3 = '#8990b3';
const DARK5 = '#68709a';
const TEXT_BRIGHT = '#24325f';
const BLUE = '#2e7de9';
const BLUE0 = '#7890dd';
const CYAN = '#007197';
const MAGENTA = '#9854f1';
const PURPLE = '#7847bd';
const GREEN = '#587539';
const ORANGE = '#b15c00';
const RED = '#f52a65';
const TEAL = '#118c74';
const YELLOW = '#8c6c3e';
const ERROR = '#c64343';

const tokyoDay = merge(cloneDeep(oro), {
  mode: 'light',
  text: {
    primary: FG,
    secondary: FG_DARK,
    bright: TEXT_BRIGHT,
    icon: FG_DARK,
    notesLight: FG_DARK,
    title: FG,
    notesMedium: FG_DARK,
    notesDark: FG,
    content: DARK5,
    contrastText: FG,
    darkBlue: BLUE,
    robotAvatar: BLUE,
    statusError: RED,
    lightGray: DARK5,
    mediumDarkGray: DARK3,
    muted: COMMENT,
    mutedDark: DARK5,
    subtle: DARK3,
    buttonText: DARK5,
    inactive: COMMENT,
    inputLabel: DARK5,
    detailsLabel: DARK5,
    detailsValue: FG,
    pendingDot: RED,
    // White on the blue approve button
    onApprove: '#FFFFFF',
    heading: TEXT_BRIGHT,
    subheading: DARK5,
  },
  background: {
    default: BG,
    // Lighter than default: light-theme paper floats above the background
    paper: PAPER,
    blueLightBackground: BG,
    lightBackground: BG,
    tabSelected: BLUE,
    titleBar: PAPER,
    spaceIntelligence: BG_DARK,
    navLight: BG,
    navMedium: BG_DARK,
    navDark: BG_DARK1,
    surface: PAPER,
    mintAccent: TEAL,
    mintAccentDim: '#C9E3DC',
    orangeAccent: ORANGE,
    orangeAccentDim: '#EAD5BD',
    lightBlue: BG,
    veryLightGray: BG,
    lightGray: BG_DARK,
    gray: BG_DARK,
    darkGray: BG_HIGHLIGHT,
    black: BG_DARK1,
    brightBlue: BLUE,
    devMagenta: MAGENTA,
    loadingBarGray: BG_HIGHLIGHT,
    loadingBarTransparentGray: '#c4c8da00',
    onHoverGray: BG_DARK,
    zeroData: BG_DARK,
    robOpsCopilotTable: BG,
    softGray: BG,
    borderGray: BG_HIGHLIGHT,
    borderLight: FG_GUTTER,
    borderMedium: DARK3,
    chip: BG_HIGHLIGHT,
    selected: BLUE0,
    offlineBar: ORANGE,
    accentPurpleHover: '#1A5CD0',
    sidebar: BG_DARK,
    sidebarBorder: FG_GUTTER,
    userCardBg: BG_DARK,
    detailsBorder: FG_GUTTER,
    pendingBg: 'rgba(245, 42, 101, 0.1)',
    rejectBorder: DARK5,
    approveBtn: BLUE,
    selectedNav: BG_DARK1,
  },
  modes: {
    mission: GREEN,
    idle: MAGENTA,
    error: RED,
    charging: YELLOW,
    others: COMMENT,
    modeBrown: YELLOW,
    modeBlue: CYAN,
  },
  incidents: {
    ok: BLUE,
    resolved: GREEN,
    warning: YELLOW,
    error: RED,
    inactive: COMMENT,
    staleOk: '#A9C5F2',
    staleWarning: '#C4AA85',
    staleError: '#F4A0B7',
    staleInactive: '#B6BCCF',
    selectedBorder: BLUE0,
  },
  diagnostics: {
    ok: BLUE,
    warning: YELLOW,
    stale: COMMENT,
    error: ERROR,
  },
  teleop: {
    actionButton: ORANGE,
    actionButtonLight: '#D47F2E',
    hoverActionButton: '#8A4800',
    planedPath: GREEN,
    wayPoint: '#3F5429',
    completedPath: BLUE0,
    openTeleop: ORANGE,
    waypointAvatar: TEAL,
  },
  map: {
    point: `${BLUE}E6`,
    pointOutline: FG_GUTTER,
    selected: CYAN,
    relocalizeDrag: {
      color: `${TEAL}4D`,
      stroke: TEAL,
    },
    relocalizeRotate: {
      color: TEAL,
      stroke: TEAL,
    },
    relocalizeInnerFrame: BLUE,
    selectedOutline: BLUE,
    robotPoseNormalPrimary: BLUE,
    robotPoseNormalSecondary: FG_GUTTER,
    robotPoseNormalOutline: BLUE,
    robotPoseSelectedPrimary: BLUE,
    robotPoseSelectedSecondary: FG_GUTTER,
    robotPoseSelectedArrow: BLUE,
  },
  joystick: {
    // Light theme: the joystick well is a light-medium gray, not near-black
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${BG_HIGHLIGHT} 0%, ${BG_DARK} 40.82%, ${BG_DARK1} 59.53%, ${BG_DARK1} 100%)`,
  },
  severityColor: {
    'SEV 0': PURPLE,
    'SEV 1': MAGENTA,
    'SEV 2': '#B98EF4',
    'SEV 3': '#DCC7FA',
  },
  tags: {
    // Too pale for a light background in the ORO base
    yellow: YELLOW,
    lightBeige: '#A98A63',
  },
  shadowColor: {
    white: '#2e3c6414',
  },
  teleopArrows: {
    stepwise: GREEN,
    teleop: ORANGE,
  },
  cameras: {
    delayTime: YELLOW,
  },
  icons: {
    lightGray: FG_DARK,
  },
  primary: {
    lighter: BG,
    light: BG_HIGHLIGHT,
    main: BG_DARK,
    dark: BG_DARK1,
    contrastDefaultColor: 'dark',
    contrastText: FG,
  },
  secondary: {
    main: BLUE,
  },
  laserPoints: {
    primary: `${BLUE}CC`,
    secondary: `${RED}CC`,
    tertiary: `${YELLOW}CC`,
  },
  zeroData: {
    // Pale-on-dark illustration colors mapped to medium-dark equivalents
    softBlue: BLUE0,
    gray: FG_GUTTER,
    softOrange: '#D89B66',
    lightBlue: '#9AA1CE',
    orangeLighter: '#C7A15F',
  },
  boxShadow: {
    white: '#00000019',
  },
  snackbar: {
    success: GREEN,
    error: ERROR,
    info: BLUE,
    warning: ORANGE,
  },
  copilotContextChips: {
    color: BLUE,
    bg: `${BLUE}14`,
    hoverBg: `${BLUE}29`,
  },
});

export default tokyoDay;
