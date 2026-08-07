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
 * Monokai theme tokens (proof of concept).
 *
 * Based on the classic Monokai editor palette:
 *   bg #272822, fg #F8F8F2, comment #75715E, green #A6E22E, pink #F92672,
 *   blue #66D9EF, orange #FD971F, yellow #E6DB74, purple #AE81FF
 *
 * Any token not overridden here inherits from the default ORO theme.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Base Monokai colors
const BG = '#272822';
const BG_DARK = '#1E1F1C';
const BG_DARKER = '#171812';
const BG_LIGHT = '#2D2E27';
const BG_LIGHTER = '#3E3D32';
const BORDER = '#49483E';
const FG = '#F8F8F2';
const COMMENT = '#75715E';
const GRAY_TEXT = '#A59F85';
const GREEN = '#A6E22E';
const PINK = '#F92672';
const BLUE = '#66D9EF';
const ORANGE = '#FD971F';
const YELLOW = '#E6DB74';
const PURPLE = '#AE81FF';

const monokai = merge(cloneDeep(oro), {
  mode: 'dark',
  text: {
    primary: FG,
    secondary: GRAY_TEXT,
    bright: FG,
    icon: GRAY_TEXT,
    notesLight: GRAY_TEXT,
    title: '#DDD9C9',
    notesMedium: GRAY_TEXT,
    notesDark: FG,
    content: '#C8C4B7',
    contrastText: FG,
    darkBlue: GREEN,
    // Green, not Monokai purple: purple would read as the (purple) default theme
    robotAvatar: GREEN,
    statusError: PINK,
    lightGray: '#C8C4B7',
    mediumDarkGray: GRAY_TEXT,
    muted: GRAY_TEXT,
    mutedDark: COMMENT,
    subtle: '#D5D2C5',
    buttonText: '#DEDBD2',
    inactive: COMMENT,
    inputLabel: '#8F8B7A',
    detailsLabel: '#B8B4A2',
    detailsValue: '#E8E5D8',
    pendingDot: YELLOW,
    onApprove: BG_DARKER,
    heading: '#EAE7DA',
    subheading: GRAY_TEXT,
  },
  background: {
    default: BG,
    paper: BG_DARK,
    blueLightBackground: BG,
    lightBackground: BG,
    tabSelected: GREEN,
    titleBar: BG_DARK,
    spaceIntelligence: BG_LIGHT,
    navLight: BG,
    navMedium: BG_DARK,
    navDark: BG_DARKER,
    surface: BG_DARK,
    mintAccent: GREEN,
    mintAccentDim: '#3E4A1E',
    orangeAccent: ORANGE,
    orangeAccentDim: '#5A3A10',
    lightBlue: BG,
    veryLightGray: BG,
    lightGray: BG_LIGHT,
    gray: BG_LIGHT,
    darkGray: BG_LIGHT,
    black: BG_DARKER,
    brightBlue: GREEN,
    devMagenta: PINK,
    loadingBarGray: BG_LIGHT,
    loadingBarTransparentGray: '#2D2E2700',
    onHoverGray: BG_LIGHT,
    zeroData: BG_LIGHT,
    robOpsCopilotTable: BG,
    softGray: BG,
    borderGray: BG_LIGHT,
    borderLight: BORDER,
    borderMedium: '#5B5A4E',
    chip: BG_LIGHTER,
    selected: COMMENT,
    offlineBar: ORANGE,
    zoneDefaultColor: YELLOW,
    accentPurpleHover: '#C1E85C',
    sidebar: BG_DARK,
    sidebarBorder: BORDER,
    userCardBg: BG_DARK,
    detailsBorder: BORDER,
    pendingBg: 'rgba(117, 113, 94, 0.3)',
    rejectBorder: COMMENT,
    approveBtn: GREEN,
    selectedNav: BG_LIGHTER,
  },
  modes: {
    mission: GREEN,
    idle: PURPLE,
    error: PINK,
    charging: YELLOW,
    others: COMMENT,
    modeBrown: YELLOW,
    modeBlue: BLUE,
  },
  incidents: {
    ok: BLUE,
    resolved: GREEN,
    warning: YELLOW,
    error: PINK,
    inactive: COMMENT,
    staleOk: '#B5ECF7',
    staleWarning: '#F3EDBA',
    staleError: '#FCA3C4',
    staleInactive: '#D5D2C5',
    selectedBorder: BLUE,
  },
  diagnostics: {
    ok: BLUE,
    warning: YELLOW,
    stale: COMMENT,
    error: PINK,
  },
  teleop: {
    actionButton: ORANGE,
    actionButtonLight: '#FDB44F',
    hoverActionButton: '#CF7A14',
    planedPath: GREEN,
    wayPoint: '#5E7207',
    completedPath: BLUE,
    openTeleop: ORANGE,
    waypointAvatar: YELLOW,
  },
  map: {
    point: `${PURPLE}E6`,
    pointOutline: BORDER,
    selected: BLUE,
    relocalizeDrag: {
      color: `${GREEN}4D`,
      stroke: GREEN,
    },
    relocalizeRotate: {
      color: GREEN,
      stroke: GREEN,
    },
    relocalizeInnerFrame: GREEN,
    selectedOutline: PURPLE,
    // Green robot pose (purple would read as the default theme)
    robotPoseNormalPrimary: GREEN,
    robotPoseNormalSecondary: BORDER,
    robotPoseNormalOutline: GREEN,
    robotPoseSelectedPrimary: GREEN,
    robotPoseSelectedSecondary: BORDER,
    robotPoseSelectedArrow: GREEN,
  },
  joystick: {
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${BG_LIGHT} 0%, ${BG_DARK} 40.82%, ${BG_DARKER} 59.53%, ${BG_DARKER} 100%)`,
  },
  severityColor: {
    'SEV 0': PINK,
    'SEV 1': ORANGE,
    'SEV 2': YELLOW,
    'SEV 3': GREEN,
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
    lightGray: GRAY_TEXT,
  },
  primary: {
    lighter: BG,
    light: BG_LIGHT,
    main: BG_DARK,
    dark: BG_DARKER,
    contrastText: FG,
  },
  secondary: {
    main: GREEN,
  },
  laserPoints: {
    primary: `${BLUE}CC`,
    secondary: `${PINK}CC`,
    tertiary: `${YELLOW}CC`,
  },
  zone: {
    defaultColor: YELLOW,
  },
  snackbar: {
    success: GREEN,
    error: PINK,
    info: BLUE,
    warning: ORANGE,
  },
  copilotContextChips: {
    color: GREEN,
    bg: `${GREEN}14`,
    hoverBg: `${GREEN}29`,
  },
});

export default monokai;
