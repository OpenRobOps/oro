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
 * Catppuccin Mocha theme tokens (dark).
 *
 * Based on the canonical Catppuccin Mocha palette (catppuccin/palette):
 *   base #1E1E2E, mantle #181825, crust #11111B, text #CDD6F4,
 *   surfaces #313244/#45475A/#585B70, overlays #6C7086/#7F849C/#9399B2,
 *   mauve #CBA6F7, red #F38BA8, maroon #EBA0AC, peach #FAB387,
 *   yellow #F9E2AF, green #A6E3A1, teal #94E2D5, sky #89DCEB,
 *   sapphire #74C7EC, blue #89B4FA, lavender #B4BEFE, pink #F5C2E7
 *
 * Any token not overridden here inherits from the default ORO theme.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Base Catppuccin Mocha colors
const BASE = '#1E1E2E';
const MANTLE = '#181825';
const CRUST = '#11111B';
const TEXT = '#CDD6F4';
const SUBTEXT1 = '#BAC2DE';
const SUBTEXT0 = '#A6ADC8';
const OVERLAY2 = '#9399B2';
const OVERLAY1 = '#7F849C';
const OVERLAY0 = '#6C7086';
const SURFACE2 = '#585B70';
const SURFACE1 = '#45475A';
const SURFACE0 = '#313244';
const PINK = '#F5C2E7';
const MAUVE = '#CBA6F7';
const RED = '#F38BA8';
const MAROON = '#EBA0AC';
const PEACH = '#FAB387';
const YELLOW = '#F9E2AF';
const GREEN = '#A6E3A1';
const TEAL = '#94E2D5';
const SKY = '#89DCEB';
const SAPPHIRE = '#74C7EC';
const BLUE = '#89B4FA';
const LAVENDER = '#B4BEFE';

const catppuccinMocha = merge(cloneDeep(oro), {
  mode: 'dark',
  text: {
    primary: TEXT,
    secondary: SUBTEXT0,
    bright: TEXT,
    icon: SUBTEXT0,
    notesLight: SUBTEXT0,
    title: SUBTEXT1,
    notesMedium: SUBTEXT0,
    notesDark: TEXT,
    content: SUBTEXT1,
    contrastText: TEXT,
    darkBlue: MAUVE,
    // Blue, not mauve: mauve would read as the (purple) default theme
    robotAvatar: BLUE,
    statusError: RED,
    lightGray: SUBTEXT1,
    mediumDarkGray: SUBTEXT0,
    muted: OVERLAY1,
    mutedDark: OVERLAY0,
    subtle: SUBTEXT1,
    buttonText: SUBTEXT1,
    inactive: OVERLAY0,
    inputLabel: OVERLAY1,
    detailsLabel: SUBTEXT0,
    detailsValue: SUBTEXT1,
    pendingDot: PINK,
    onApprove: CRUST,
    onAccent: CRUST,
    heading: TEXT,
    subheading: SUBTEXT0,
  },
  background: {
    default: BASE,
    paper: MANTLE,
    blueLightBackground: BASE,
    lightBackground: BASE,
    tabSelected: MAUVE,
    titleBar: MANTLE,
    spaceIntelligence: SURFACE0,
    navLight: BASE,
    navMedium: MANTLE,
    navDark: CRUST,
    surface: MANTLE,
    mintAccent: GREEN,
    mintAccentDim: '#2D4A3A',
    orangeAccent: PEACH,
    orangeAccentDim: '#5A3A25',
    lightBlue: BASE,
    veryLightGray: BASE,
    lightGray: SURFACE0,
    gray: SURFACE0,
    darkGray: SURFACE0,
    black: CRUST,
    brightBlue: MAUVE,
    devMagenta: PINK,
    loadingBarGray: SURFACE0,
    loadingBarTransparentGray: '#31324400',
    onHoverGray: SURFACE0,
    zeroData: SURFACE0,
    robOpsCopilotTable: BASE,
    softGray: BASE,
    borderGray: SURFACE0,
    borderLight: SURFACE1,
    borderMedium: SURFACE2,
    chip: SURFACE1,
    selected: OVERLAY0,
    offlineBar: PEACH,
    zoneDefaultColor: YELLOW,
    accentPurpleHover: LAVENDER,
    sidebar: MANTLE,
    sidebarBorder: SURFACE1,
    userCardBg: MANTLE,
    detailsBorder: SURFACE1,
    pendingBg: 'rgba(243, 139, 168, 0.15)',
    rejectBorder: OVERLAY1,
    approveBtn: MAUVE,
    accentSolid: MAUVE,
    selectedNav: SURFACE1,
  },
  modes: {
    mission: GREEN,
    idle: MAUVE,
    error: RED,
    charging: YELLOW,
    others: OVERLAY0,
    modeBrown: PEACH,
    modeBlue: BLUE,
  },
  incidents: {
    ok: BLUE,
    resolved: GREEN,
    warning: YELLOW,
    error: RED,
    inactive: OVERLAY0,
    staleOk: '#B7CFFC',
    staleWarning: '#FBEECB',
    staleError: '#F7B6C6',
    staleInactive: OVERLAY2,
    selectedBorder: BLUE,
  },
  diagnostics: {
    ok: BLUE,
    warning: YELLOW,
    stale: OVERLAY0,
    error: MAROON,
  },
  teleop: {
    actionButton: PEACH,
    actionButtonLight: '#FCC89F',
    hoverActionButton: '#E89A6E',
    planedPath: GREEN,
    wayPoint: '#5E8C58',
    completedPath: SAPPHIRE,
    openTeleop: PEACH,
    waypointAvatar: TEAL,
  },
  map: {
    point: `${BLUE}E6`,
    pointOutline: SURFACE1,
    selected: SKY,
    relocalizeDrag: {
      color: `${GREEN}4D`,
      stroke: GREEN,
    },
    relocalizeRotate: {
      color: GREEN,
      stroke: GREEN,
    },
    relocalizeInnerFrame: BLUE,
    selectedOutline: LAVENDER,
    // Blue robot pose (mauve would read as the default theme)
    robotPoseNormalPrimary: BLUE,
    robotPoseNormalSecondary: SURFACE1,
    robotPoseNormalOutline: BLUE,
    robotPoseSelectedPrimary: BLUE,
    robotPoseSelectedSecondary: SURFACE1,
    robotPoseSelectedArrow: BLUE,
  },
  joystick: {
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${SURFACE0} 0%, ${MANTLE} 40.82%, ${CRUST} 59.53%, ${CRUST} 100%)`,
  },
  severityColor: {
    'SEV 0': '#8C5AE8',
    'SEV 1': MAUVE,
    'SEV 2': PINK,
    'SEV 3': '#FBE4F4',
  },
  shadowColor: {
    white: `${TEXT}1A`,
  },
  teleopArrows: {
    stepwise: GREEN,
    teleop: PEACH,
  },
  cameras: {
    delayTime: YELLOW,
  },
  icons: {
    lightGray: SUBTEXT0,
  },
  primary: {
    lighter: BASE,
    light: SURFACE0,
    main: MANTLE,
    dark: CRUST,
    contrastText: TEXT,
  },
  secondary: {
    main: MAUVE,
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
    error: RED,
    info: BLUE,
    warning: PEACH,
  },
  copilotContextChips: {
    color: MAUVE,
    bg: `${MAUVE}14`,
    hoverBg: `${MAUVE}29`,
  },
});

export default catppuccinMocha;
