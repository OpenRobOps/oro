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
 * Catppuccin Latte theme tokens (light).
 *
 * Based on the canonical Catppuccin Latte palette (catppuccin/palette):
 *   base #EFF1F5, mantle #E6E9EF, crust #DCE0E8, text #4C4F69,
 *   surfaces #CCD0DA/#BCC0CC/#ACB0BE, overlays #9CA0B0/#8C8FA1/#7C7F93,
 *   mauve #8839EF, red #D20F39, maroon #E64553, peach #FE640B,
 *   yellow #DF8E1D, green #40A02B, teal #179299, sky #04A5E5,
 *   sapphire #209FB5, blue #1E66F5, lavender #7287FD, pink #EA76CB,
 *   rosewater #DC8A78
 *
 * The ORO base theme is dark, so every token that assumes a dark background
 * is overridden here. Any token not overridden inherits from ORO.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Base Catppuccin Latte colors
const BASE = '#EFF1F5';
const MANTLE = '#E6E9EF';
const CRUST = '#DCE0E8';
const TEXT = '#4C4F69';
const SUBTEXT1 = '#5C5F77';
const SUBTEXT0 = '#6C6F85';
const OVERLAY2 = '#7C7F93';
const OVERLAY1 = '#8C8FA1';
const OVERLAY0 = '#9CA0B0';
const SURFACE2 = '#ACB0BE';
const SURFACE1 = '#BCC0CC';
const SURFACE0 = '#CCD0DA';
const ROSEWATER = '#DC8A78';
const PINK = '#EA76CB';
const MAUVE = '#8839EF';
const RED = '#D20F39';
const MAROON = '#E64553';
const PEACH = '#FE640B';
const YELLOW = '#DF8E1D';
const GREEN = '#40A02B';
const TEAL = '#179299';
const SKY = '#04A5E5';
const SAPPHIRE = '#209FB5';
const BLUE = '#1E66F5';
const LAVENDER = '#7287FD';

const catppuccinLatte = merge(cloneDeep(oro), {
  mode: 'light',
  text: {
    primary: TEXT,
    secondary: SUBTEXT0,
    bright: '#40435C',
    icon: SUBTEXT0,
    notesLight: SUBTEXT0,
    title: SUBTEXT1,
    notesMedium: SUBTEXT0,
    notesDark: TEXT,
    content: SUBTEXT1,
    contrastText: TEXT,
    darkBlue: MAUVE,
    robotAvatar: MAUVE,
    statusError: RED,
    lightGray: SUBTEXT1,
    mediumDarkGray: SUBTEXT0,
    muted: OVERLAY1,
    mutedDark: OVERLAY0,
    subtle: OVERLAY2,
    buttonText: SUBTEXT1,
    inactive: OVERLAY0,
    inputLabel: OVERLAY1,
    detailsLabel: SUBTEXT0,
    detailsValue: SUBTEXT1,
    pendingDot: PINK,
    // Approve button is mauve; light base text contrasts it
    onApprove: BASE,
    onAccent: BASE,
    heading: TEXT,
    subheading: SUBTEXT0,
  },
  background: {
    default: BASE,
    // Lighter sibling of base so paper (menus/cards) reads as elevated
    paper: '#F7F8FA',
    blueLightBackground: BASE,
    lightBackground: BASE,
    tabSelected: MAUVE,
    titleBar: MANTLE,
    // Surface0, not mantle: used as the gauge track, which must stand out
    // from the base/paper widget backgrounds
    spaceIntelligence: SURFACE0,
    navLight: BASE,
    navMedium: MANTLE,
    navDark: CRUST,
    surface: MANTLE,
    mintAccent: GREEN,
    mintAccentDim: '#D8EED4',
    orangeAccent: PEACH,
    orangeAccentDim: '#FBE0CF',
    lightBlue: BASE,
    veryLightGray: BASE,
    lightGray: SURFACE0,
    gray: SURFACE0,
    darkGray: SURFACE0,
    black: CRUST,
    brightBlue: MAUVE,
    devMagenta: PINK,
    loadingBarGray: SURFACE0,
    loadingBarTransparentGray: '#CCD0DA00',
    onHoverGray: MANTLE,
    zeroData: SURFACE0,
    robOpsCopilotTable: BASE,
    softGray: BASE,
    borderGray: SURFACE0,
    borderLight: SURFACE1,
    borderMedium: SURFACE2,
    chip: SURFACE0,
    selected: SURFACE2,
    offlineBar: PEACH,
    zoneDefaultColor: YELLOW,
    accentPurpleHover: '#7326D3',
    sidebar: MANTLE,
    sidebarBorder: SURFACE1,
    userCardBg: MANTLE,
    detailsBorder: SURFACE1,
    pendingBg: 'rgba(234, 118, 203, 0.12)',
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
    modeBrown: YELLOW,
    modeBlue: BLUE,
  },
  incidents: {
    ok: BLUE,
    resolved: GREEN,
    warning: YELLOW,
    error: RED,
    inactive: OVERLAY0,
    staleOk: '#9DB8F0',
    staleWarning: '#ECD0A0',
    staleError: '#EBA4AE',
    staleInactive: SURFACE2,
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
    actionButtonLight: '#FF8F4C',
    hoverActionButton: '#D15208',
    planedPath: GREEN,
    wayPoint: '#2D7A1E',
    completedPath: SAPPHIRE,
    openTeleop: PEACH,
    waypointAvatar: TEAL,
  },
  map: {
    point: `${BLUE}E6`,
    pointOutline: OVERLAY2,
    selected: SKY,
    relocalizeDrag: {
      color: `${GREEN}4D`,
      stroke: GREEN,
    },
    relocalizeRotate: {
      color: GREEN,
      stroke: GREEN,
    },
    relocalizeInnerFrame: MAUVE,
    selectedOutline: LAVENDER,
    robotPoseNormalPrimary: MAUVE,
    robotPoseNormalSecondary: SURFACE1,
    robotPoseNormalOutline: MAUVE,
    robotPoseSelectedPrimary: MAUVE,
    robotPoseSelectedSecondary: SURFACE1,
    robotPoseSelectedArrow: MAUVE,
  },
  joystick: {
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${SURFACE0} 0%, ${SURFACE1} 40.82%, ${SURFACE2} 59.53%, ${SURFACE2} 100%)`,
  },
  severityColor: {
    'SEV 0': '#6820C6',
    'SEV 1': MAUVE,
    'SEV 2': PINK,
    'SEV 3': '#F2A7DD',
  },
  tags: {
    skyBlue: SKY,
    greenBlue: TEAL,
    poloBlue: LAVENDER,
    lightOrange: PEACH,
    yellow: YELLOW,
    pink: PINK,
    lightBeige: ROSEWATER,
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
    contrastDefaultColor: 'dark',
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
  zeroData: {
    softBlue: BLUE,
    gray: OVERLAY0,
    softPink: PINK,
    softOrange: PEACH,
    darkBlue: SAPPHIRE,
    lightBlue: LAVENDER,
    orangeLighter: YELLOW,
  },
  boxShadow: {
    white: '#00000019',
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

export default catppuccinLatte;
