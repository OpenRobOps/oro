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
 * Tokyo Night theme tokens.
 *
 * Based on the canonical Tokyo Night palette (folke/tokyonight.nvim, night style):
 *   bg #1a1b26, fg #c0caf5, comment #565f89, blue #7aa2f7, cyan #7dcfff,
 *   magenta #bb9af7, green #9ece6a, orange #ff9e64, red #f7768e, yellow #e0af68
 *
 * Any token not overridden here inherits from the default ORO theme.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Base Tokyo Night colors
const BG = '#1a1b26';
const BG_DARK = '#16161e';
const BG_DARK1 = '#0C0E14';
const BG_HIGHLIGHT = '#292e42';
const FG = '#c0caf5';
const FG_DARK = '#a9b1d6';
const FG_GUTTER = '#3b4261';
const COMMENT = '#565f89';
const DARK3 = '#545c7e';
const DARK5 = '#737aa2';
const BLUE = '#7aa2f7';
const BLUE0 = '#3d59a1';
const BLUE6 = '#b4f9f8';
const CYAN = '#7dcfff';
const MAGENTA = '#bb9af7';
const PURPLE = '#9d7cd8';
const GREEN = '#9ece6a';
const GREEN1 = '#73daca';
const ORANGE = '#ff9e64';
const RED = '#f7768e';
const RED1 = '#db4b4b';
const YELLOW = '#e0af68';

const tokyoNight = merge(cloneDeep(oro), {
  mode: 'dark',
  text: {
    primary: FG,
    secondary: FG_DARK,
    bright: FG,
    icon: FG_DARK,
    notesLight: FG_DARK,
    title: FG,
    notesMedium: FG_DARK,
    notesDark: FG,
    content: FG_DARK,
    contrastText: FG,
    darkBlue: BLUE,
    // Blue, not Tokyo Night magenta: magenta would read as the (purple) default theme
    robotAvatar: BLUE,
    statusError: RED,
    lightGray: FG_DARK,
    mediumDarkGray: FG_DARK,
    muted: COMMENT,
    mutedDark: DARK3,
    subtle: FG_DARK,
    buttonText: FG_DARK,
    inactive: DARK5,
    inputLabel: DARK5,
    detailsLabel: FG_DARK,
    detailsValue: FG,
    pendingDot: RED,
    onApprove: BG_DARK1,
    heading: FG,
    subheading: DARK5,
  },
  background: {
    default: BG,
    paper: BG_DARK,
    blueLightBackground: BG,
    lightBackground: BG,
    tabSelected: BLUE,
    titleBar: BG_DARK,
    spaceIntelligence: BG_HIGHLIGHT,
    navLight: BG,
    navMedium: BG_DARK,
    navDark: BG_DARK1,
    surface: BG_DARK,
    mintAccent: GREEN1,
    mintAccentDim: '#1D403B',
    orangeAccent: ORANGE,
    orangeAccentDim: '#59331D',
    lightBlue: BG,
    veryLightGray: BG,
    lightGray: BG_HIGHLIGHT,
    gray: BG_HIGHLIGHT,
    darkGray: BG_HIGHLIGHT,
    black: BG_DARK1,
    brightBlue: BLUE,
    devMagenta: MAGENTA,
    loadingBarGray: BG_HIGHLIGHT,
    loadingBarTransparentGray: '#292e4200',
    onHoverGray: BG_HIGHLIGHT,
    zeroData: BG_HIGHLIGHT,
    robOpsCopilotTable: BG,
    softGray: BG,
    borderGray: BG_HIGHLIGHT,
    borderLight: FG_GUTTER,
    borderMedium: DARK3,
    chip: BG_HIGHLIGHT,
    selected: BLUE0,
    offlineBar: ORANGE,
    zoneDefaultColor: YELLOW,
    accentPurpleHover: '#9DB6FA',
    sidebar: BG_DARK,
    sidebarBorder: FG_GUTTER,
    userCardBg: BG_DARK,
    detailsBorder: FG_GUTTER,
    pendingBg: 'rgba(59, 66, 97, 0.3)',
    rejectBorder: DARK5,
    approveBtn: BLUE,
    selectedNav: BG_HIGHLIGHT,
  },
  modes: {
    mission: GREEN1,
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
    staleOk: '#B8CCFB',
    staleWarning: '#F0DDB4',
    staleError: '#F8B6C2',
    staleInactive: '#C8CBD8',
    selectedBorder: BLUE0,
  },
  diagnostics: {
    ok: BLUE,
    warning: YELLOW,
    stale: COMMENT,
    error: RED1,
  },
  teleop: {
    actionButton: ORANGE,
    actionButtonLight: '#FFB380',
    hoverActionButton: '#D97E46',
    planedPath: GREEN,
    wayPoint: '#5C7A3A',
    completedPath: BLUE0,
    openTeleop: ORANGE,
    waypointAvatar: BLUE6,
  },
  map: {
    point: `${BLUE}E6`,
    pointOutline: FG_GUTTER,
    selected: CYAN,
    relocalizeDrag: {
      color: `${GREEN1}4D`,
      stroke: GREEN1,
    },
    relocalizeRotate: {
      color: GREEN1,
      stroke: GREEN1,
    },
    relocalizeInnerFrame: BLUE,
    // Blue robot pose (magenta would read as the default theme)
    selectedOutline: BLUE,
    robotPoseNormalPrimary: BLUE,
    robotPoseNormalSecondary: FG_GUTTER,
    robotPoseNormalOutline: BLUE,
    robotPoseSelectedPrimary: BLUE,
    robotPoseSelectedSecondary: FG_GUTTER,
    robotPoseSelectedArrow: BLUE,
  },
  joystick: {
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${BG_HIGHLIGHT} 0%, ${BG_DARK} 40.82%, ${BG_DARK1} 59.53%, ${BG_DARK1} 100%)`,
  },
  severityColor: {
    'SEV 0': PURPLE,
    'SEV 1': MAGENTA,
    'SEV 2': '#D7C4FB',
    'SEV 3': '#EEE3FF',
  },
  shadowColor: {
    white: `${FG}1A`,
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
  zone: {
    defaultColor: YELLOW,
  },
  snackbar: {
    success: GREEN,
    error: RED1,
    info: BLUE,
    warning: ORANGE,
  },
  copilotContextChips: {
    color: BLUE,
    bg: `${BLUE}14`,
    hoverBg: `${BLUE}29`,
  },
});

export default tokyoNight;
