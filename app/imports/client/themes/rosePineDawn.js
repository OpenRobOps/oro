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
 * Rosé Pine Dawn theme tokens (light).
 *
 * Based on the canonical Rosé Pine Dawn palette (rose-pine/palette):
 *   base #faf4ed, surface #fffaf3, overlay #f2e9e1, muted #9893a5,
 *   subtle #797593, text #575279, love #b4637a, gold #ea9d34,
 *   rose #d7827e, pine #286983, foam #56949f, iris #907aa9,
 *   highlight low/med/high #f4ede8/#dfdad9/#cecacd
 *
 * The ORO base is dark, so every token that assumes a dark background is
 * overridden here with a dark-on-light equivalent. Any token not overridden
 * inherits from the default ORO theme.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Base Rosé Pine Dawn colors
const BASE = '#faf4ed';
const SURFACE = '#fffaf3';
const OVERLAY = '#f2e9e1';
const HIGHLIGHT_MED = '#dfdad9';
const HIGHLIGHT_HIGH = '#cecacd';
const TEXT = '#575279';
const TEXT_BRIGHT = '#464261';
const SUBTLE = '#797593';
const MUTED = '#9893a5';
const LOVE = '#b4637a';
const GOLD = '#ea9d34';
const ROSE = '#d7827e';
const ROSE_LIGHT = '#e3a9a6';
const PINE = '#286983';
const FOAM = '#56949f';
const IRIS = '#907aa9';
// Rosé Pine (main) base — this palette has no dark of its own, and light
// accent fills need dark ink. See onAccent below.
const INK = '#21202e';

const rosePineDawn = merge(cloneDeep(oro), {
  mode: 'light',
  text: {
    primary: TEXT,
    secondary: SUBTLE,
    bright: TEXT_BRIGHT,
    icon: SUBTLE,
    notesLight: SUBTLE,
    title: TEXT,
    notesMedium: SUBTLE,
    notesDark: TEXT,
    content: SUBTLE,
    contrastText: TEXT,
    darkBlue: ROSE,
    robotAvatar: ROSE,
    statusError: LOVE,
    lightGray: SUBTLE,
    mediumDarkGray: MUTED,
    muted: MUTED,
    mutedDark: SUBTLE,
    subtle: MUTED,
    buttonText: SUBTLE,
    inactive: MUTED,
    inputLabel: SUBTLE,
    detailsLabel: SUBTLE,
    detailsValue: TEXT,
    pendingDot: LOVE,
    // White on the rose approve button
    onApprove: INK,
    // White on ROSE is 2.6:1 and fails AA. INK on ROSE is 5.63:1.
    onAccent: INK,
    heading: TEXT_BRIGHT,
    subheading: SUBTLE,
  },
  background: {
    default: BASE,
    // Lighter than default: light-theme paper floats above the background
    paper: SURFACE,
    blueLightBackground: BASE,
    lightBackground: BASE,
    tabSelected: ROSE,
    titleBar: SURFACE,
    spaceIntelligence: OVERLAY,
    navLight: BASE,
    navMedium: OVERLAY,
    navDark: HIGHLIGHT_HIGH,
    surface: SURFACE,
    mintAccent: FOAM,
    mintAccentDim: '#D6E2E4',
    orangeAccent: GOLD,
    orangeAccentDim: '#F3DDC0',
    lightBlue: BASE,
    veryLightGray: BASE,
    lightGray: OVERLAY,
    gray: OVERLAY,
    darkGray: HIGHLIGHT_MED,
    black: HIGHLIGHT_HIGH,
    brightBlue: ROSE,
    devMagenta: IRIS,
    loadingBarGray: HIGHLIGHT_MED,
    loadingBarTransparentGray: '#dfdad900',
    onHoverGray: OVERLAY,
    zeroData: OVERLAY,
    robOpsCopilotTable: BASE,
    softGray: BASE,
    borderGray: HIGHLIGHT_MED,
    borderLight: HIGHLIGHT_HIGH,
    borderMedium: MUTED,
    chip: HIGHLIGHT_MED,
    selected: ROSE_LIGHT,
    offlineBar: GOLD,
    zoneDefaultColor: GOLD,
    // Lighter on hover, not darker: the ink is dark here, so INK on the old
    // #B96560 was 3.89:1. INK on ROSE_LIGHT is 8.0:1.
    accentPurpleHover: ROSE_LIGHT,
    sidebar: OVERLAY,
    sidebarBorder: HIGHLIGHT_HIGH,
    userCardBg: OVERLAY,
    detailsBorder: HIGHLIGHT_HIGH,
    pendingBg: 'rgba(180, 99, 122, 0.1)',
    rejectBorder: SUBTLE,
    approveBtn: ROSE,
    accentSolid: ROSE,
    selectedNav: HIGHLIGHT_HIGH,
  },
  modes: {
    mission: FOAM,
    idle: IRIS,
    error: LOVE,
    charging: GOLD,
    others: MUTED,
    modeBrown: GOLD,
    modeBlue: PINE,
  },
  incidents: {
    ok: ROSE,
    resolved: PINE,
    warning: GOLD,
    error: LOVE,
    inactive: MUTED,
    staleOk: '#EAB9B6',
    staleWarning: '#E9C48D',
    staleError: '#D5A4B0',
    staleInactive: '#C5C1CE',
    selectedBorder: ROSE_LIGHT,
  },
  diagnostics: {
    ok: ROSE,
    warning: GOLD,
    stale: MUTED,
    error: LOVE,
  },
  teleop: {
    actionButton: GOLD,
    actionButtonLight: '#F2BE71',
    hoverActionButton: '#B87A22',
    planedPath: PINE,
    wayPoint: '#1D4D60',
    completedPath: ROSE_LIGHT,
    openTeleop: GOLD,
    waypointAvatar: FOAM,
  },
  map: {
    point: `${ROSE}E6`,
    pointOutline: HIGHLIGHT_HIGH,
    selected: FOAM,
    relocalizeDrag: {
      color: `${FOAM}4D`,
      stroke: FOAM,
    },
    relocalizeRotate: {
      color: FOAM,
      stroke: FOAM,
    },
    relocalizeInnerFrame: ROSE,
    selectedOutline: ROSE,
    robotPoseNormalPrimary: ROSE,
    robotPoseNormalSecondary: HIGHLIGHT_HIGH,
    robotPoseNormalOutline: ROSE,
    robotPoseSelectedPrimary: ROSE,
    robotPoseSelectedSecondary: HIGHLIGHT_HIGH,
    robotPoseSelectedArrow: ROSE,
  },
  joystick: {
    // Light theme: the joystick well is a light-medium neutral, not near-black
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${HIGHLIGHT_MED} 0%, ${OVERLAY} 40.82%, ${HIGHLIGHT_HIGH} 59.53%, ${HIGHLIGHT_HIGH} 100%)`,
  },
  severityColor: {
    'SEV 0': '#6E5A86',
    'SEV 1': IRIS,
    'SEV 2': '#B5A3C9',
    'SEV 3': '#D8CCE4',
  },
  tags: {
    // Too pale for a light background in the ORO base
    yellow: '#B27A28',
    lightBeige: '#9C7E58',
  },
  shadowColor: {
    white: '#57527914',
  },
  teleopArrows: {
    stepwise: PINE,
    teleop: GOLD,
  },
  cameras: {
    delayTime: GOLD,
  },
  icons: {
    lightGray: SUBTLE,
  },
  primary: {
    lighter: BASE,
    light: HIGHLIGHT_MED,
    main: OVERLAY,
    dark: HIGHLIGHT_HIGH,
    contrastDefaultColor: 'dark',
    contrastText: TEXT,
  },
  secondary: {
    main: ROSE,
  },
  laserPoints: {
    primary: `${ROSE}CC`,
    secondary: `${LOVE}CC`,
    tertiary: `${GOLD}CC`,
  },
  zeroData: {
    // Pale-on-dark illustration colors mapped to medium-dark equivalents
    softBlue: FOAM,
    gray: HIGHLIGHT_HIGH,
    softOrange: '#DBA96A',
    lightBlue: '#B0A8C4',
    orangeLighter: '#CBA05C',
  },
  boxShadow: {
    white: '#00000019',
  },
  zone: {
    defaultColor: GOLD,
  },
  snackbar: {
    success: PINE,
    error: LOVE,
    info: ROSE,
    warning: GOLD,
  },
  copilotContextChips: {
    color: ROSE,
    bg: `${ROSE}14`,
    hoverBg: `${ROSE}29`,
  },
});

export default rosePineDawn;
