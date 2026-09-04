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
 * ORO Sun theme tokens (light) — the alternate scheme for bright floors and
 * printed reports, from the "ORO Product Theme" brand canvas.
 *
 * Same slate/gold/teal/violet roles as ORO Moon (./oro.js) with every
 * dark-background assumption inverted. Gold fills keep the brand value with
 * dark ink; gold used as a stroke or text is deepened to the AA value.
 * Any token not overridden inherits from ORO Moon.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Surfaces
const BG = '#F5F6F8';
const PAPER = '#FFFFFF';
const DEEP = '#E8EAEF';
const SIDEBAR = '#EFF1F4';
const CHIP = '#E1E4EA';
const BORDER = '#D5D9E1';
const BORDER_STRONG = '#B9C0CC';
// Text
const FG = '#171B26';
const FG2 = '#454C5C';
const MUTED = '#5E6777';
const MUTED_LIGHT = '#8A93A5';
// Brand accent: the fill keeps the brand value (dark ink on it); strokes,
// icons, the logo wedge and text use the deep AA gold, matching the website.
const GOLD = '#E0A526';
const GOLD_DEEP = '#8A6008';
// Lighter on hover, not darker: the ink on gold is dark (see rosePineDawn)
const GOLD_HOVER = '#EAB84A';
const GOLD_PALE = '#F2CB7A';
const ON_GOLD = '#241703';
// Supporting accents
const TEAL = '#0E7C89';
const TEAL_PALE = '#CDE9EC';
const VIOLET = '#5B4BC4';
// Status
const GREEN = '#127A4D';
const BLUE = '#2258C9';
const ORANGE = '#B0521A';
const RED = '#C1304A';

const oroSun = merge(cloneDeep(oro), {
  mode: 'light',
  text: {
    primary: FG,
    secondary: FG2,
    bright: FG,
    icon: FG2,
    notesLight: FG2,
    title: FG,
    notesMedium: FG2,
    notesDark: FG,
    content: FG2,
    contrastText: FG,
    darkBlue: TEAL,
    robotAvatar: VIOLET,
    statusError: RED,
    lightGray: FG2,
    mediumDarkGray: MUTED,
    muted: MUTED,
    mutedDark: MUTED_LIGHT,
    subtle: MUTED,
    buttonText: FG2,
    inactive: MUTED_LIGHT,
    inputLabel: MUTED,
    detailsLabel: FG2,
    detailsValue: FG,
    pendingDot: ORANGE,
    onApprove: ON_GOLD,
    onAccent: ON_GOLD,
    heading: FG,
    subheading: FG2,
  },
  background: {
    default: BG,
    // Lighter than default: light-theme paper floats above the background
    paper: PAPER,
    blueLightBackground: BG,
    lightBackground: BG,
    tabSelected: GOLD,
    titleBar: PAPER,
    spaceIntelligence: CHIP,
    navLight: BG,
    navMedium: SIDEBAR,
    navDark: DEEP,
    surface: PAPER,
    mintAccent: GREEN,
    mintAccentDim: '#CFEADB',
    orangeAccent: ORANGE,
    orangeAccentDim: '#F5DCCB',
    lightBlue: BG,
    veryLightGray: BG,
    lightGray: CHIP,
    gray: CHIP,
    darkGray: DEEP,
    black: DEEP,
    brightBlue: TEAL,
    devMagenta: VIOLET,
    loadingBarGray: CHIP,
    loadingBarTransparentGray: `${CHIP}00`,
    onHoverGray: CHIP,
    zeroData: CHIP,
    robOpsCopilotTable: BG,
    softGray: BG,
    borderGray: CHIP,
    borderLight: BORDER,
    borderMedium: BORDER_STRONG,
    chip: CHIP,
    selected: TEAL_PALE,
    offlineBar: ORANGE,
    zoneDefaultColor: GOLD_PALE,
    accentPurpleHover: GOLD_HOVER,
    sidebar: SIDEBAR,
    sidebarBorder: BORDER,
    userCardBg: SIDEBAR,
    detailsBorder: BORDER_STRONG,
    pendingBg: 'rgba(176, 82, 26, 0.1)',
    rejectBorder: MUTED,
    approveBtn: GOLD,
    accentSolid: GOLD,
    selectedNav: CHIP,
  },
  modes: {
    mission: GREEN,
    idle: VIOLET,
    error: RED,
    charging: GOLD_DEEP,
    others: MUTED_LIGHT,
    modeBrown: GOLD_DEEP,
    modeBlue: BLUE,
  },
  incidents: {
    ok: GREEN,
    resolved: '#0E6A42',
    warning: ORANGE,
    error: RED,
    inactive: MUTED_LIGHT,
    staleOk: '#9DC9B3',
    staleWarning: '#DDB39C',
    staleError: '#E1A6B2',
    staleInactive: '#C5CAD4',
    selectedBorder: TEAL,
  },
  diagnostics: {
    ok: GREEN,
    warning: ORANGE,
    stale: MUTED_LIGHT,
    error: RED,
  },
  teleop: {
    actionButton: ORANGE,
    actionButtonLight: '#D07A4A',
    hoverActionButton: '#8E4013',
    planedPath: GREEN,
    wayPoint: '#0E6A42',
    completedPath: '#7E9BD8',
    openTeleop: ORANGE,
    waypointAvatar: '#CFEADB',
  },
  map: {
    point: `${VIOLET}E6`,
    pointOutline: BORDER_STRONG,
    selected: TEAL,
    relocalizeInnerFrame: TEAL,
    selectedOutline: VIOLET,
    robotPoseNormalPrimary: TEAL,
    robotPoseNormalSecondary: BORDER_STRONG,
    robotPoseNormalOutline: TEAL,
    robotPoseSelectedPrimary: GOLD_DEEP,
    robotPoseSelectedSecondary: BORDER_STRONG,
    robotPoseSelectedArrow: GOLD_DEEP,
  },
  joystick: {
    // Light theme: the joystick well is a light-medium neutral, not near-black
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${CHIP} 0%, ${DEEP} 40.82%, ${BORDER} 59.53%, ${BORDER} 100%)`,
  },
  severityColor: {
    'SEV 0': '#3B2E99',
    'SEV 1': VIOLET,
    'SEV 2': '#8F84D9',
    'SEV 3': '#C4BDEB',
  },
  tags: {
    // Too pale for a light background in the ORO Moon base
    yellow: '#B27A28',
    lightBeige: '#9C7E58',
  },
  teleopArrows: {
    stepwise: GREEN,
    teleop: ORANGE,
  },
  cameras: {
    delayTime: ORANGE,
  },
  icons: {
    lightGray: FG2,
  },
  primary: {
    lighter: BG,
    light: CHIP,
    main: SIDEBAR,
    dark: DEEP,
    contrastDefaultColor: 'dark',
    contrastText: FG,
  },
  secondary: {
    main: GOLD_DEEP,
  },
  laserPoints: {
    primary: `${TEAL}CC`,
    secondary: `${VIOLET}CC`,
    tertiary: `${GOLD_DEEP}CC`,
  },
  zeroData: {
    // Pale-on-dark illustration colors mapped to medium-dark equivalents
    softBlue: BLUE,
    gray: BORDER_STRONG,
    softOrange: '#D28A5A',
    lightBlue: '#9AA3BC',
    orangeLighter: GOLD_DEEP,
  },
  boxShadow: {
    white: '#00000019',
  },
  zone: {
    defaultColor: GOLD_PALE,
  },
  snackbar: {
    success: GREEN,
    error: RED,
    info: BLUE,
    warning: ORANGE,
  },
  copilotContextChips: {
    color: TEAL,
    bg: `${TEAL}14`,
    hoverBg: `${TEAL}29`,
  },
});

export default oroSun;
