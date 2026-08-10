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
 * Rosé Pine Moon theme tokens (dark).
 *
 * Based on the canonical Rosé Pine Moon palette (rose-pine/palette):
 *   base #232136, surface #2a273f, overlay #393552, muted #6e6a86,
 *   subtle #908caa, text #e0def4, love #eb6f92, gold #f6c177,
 *   rose #ea9a97, pine #3e8fb0, foam #9ccfd8, iris #c4a7e7,
 *   highlight low/med/high #2a283e/#44415a/#56526e
 *
 * Any token not overridden here inherits from the default ORO theme.
 */
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

// Base Rosé Pine Moon colors
const BASE = '#232136';
const SURFACE = '#2a273f';
// Main-variant base: the "darker than base" step Moon itself doesn't define
const SHADOW = '#191724';
const OVERLAY = '#393552';
const TEXT = '#e0def4';
const SUBTLE = '#908caa';
const MUTED = '#6e6a86';
const HIGHLIGHT_MED = '#44415a';
const HIGHLIGHT_HIGH = '#56526e';
const LOVE = '#eb6f92';
const GOLD = '#f6c177';
const ROSE = '#ea9a97';
const PINE = '#3e8fb0';
const FOAM = '#9ccfd8';
const IRIS = '#c4a7e7';

const rosePineMoon = merge(cloneDeep(oro), {
  mode: 'dark',
  text: {
    primary: TEXT,
    secondary: SUBTLE,
    bright: TEXT,
    icon: SUBTLE,
    notesLight: SUBTLE,
    title: TEXT,
    notesMedium: SUBTLE,
    notesDark: TEXT,
    content: SUBTLE,
    contrastText: TEXT,
    darkBlue: ROSE,
    // Rose, the signature accent (iris would read as the purple default theme)
    robotAvatar: ROSE,
    statusError: LOVE,
    lightGray: SUBTLE,
    mediumDarkGray: SUBTLE,
    muted: MUTED,
    mutedDark: MUTED,
    subtle: SUBTLE,
    buttonText: SUBTLE,
    inactive: MUTED,
    inputLabel: SUBTLE,
    detailsLabel: SUBTLE,
    detailsValue: TEXT,
    pendingDot: LOVE,
    onApprove: SHADOW,
    onAccent: SHADOW,
    heading: TEXT,
    subheading: SUBTLE,
  },
  background: {
    default: BASE,
    paper: SURFACE,
    blueLightBackground: BASE,
    lightBackground: BASE,
    tabSelected: ROSE,
    titleBar: SURFACE,
    spaceIntelligence: OVERLAY,
    navLight: BASE,
    navMedium: SURFACE,
    navDark: SHADOW,
    surface: SURFACE,
    mintAccent: FOAM,
    mintAccentDim: '#28414A',
    orangeAccent: GOLD,
    orangeAccentDim: '#4F3D2C',
    lightBlue: BASE,
    veryLightGray: BASE,
    lightGray: OVERLAY,
    gray: OVERLAY,
    darkGray: OVERLAY,
    black: SHADOW,
    brightBlue: ROSE,
    devMagenta: IRIS,
    loadingBarGray: OVERLAY,
    loadingBarTransparentGray: '#39355200',
    onHoverGray: OVERLAY,
    zeroData: OVERLAY,
    robOpsCopilotTable: BASE,
    softGray: BASE,
    borderGray: OVERLAY,
    borderLight: HIGHLIGHT_MED,
    borderMedium: HIGHLIGHT_HIGH,
    chip: OVERLAY,
    selected: HIGHLIGHT_HIGH,
    offlineBar: GOLD,
    zoneDefaultColor: GOLD,
    accentPurpleHover: '#F0B3B1',
    sidebar: SURFACE,
    sidebarBorder: HIGHLIGHT_MED,
    userCardBg: SURFACE,
    detailsBorder: HIGHLIGHT_MED,
    pendingBg: 'rgba(68, 65, 90, 0.3)',
    rejectBorder: SUBTLE,
    approveBtn: ROSE,
    accentSolid: ROSE,
    selectedNav: OVERLAY,
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
    staleOk: '#F3CFCE',
    staleWarning: '#FADFBB',
    staleError: '#F5B7C8',
    staleInactive: '#C9C6D9',
    selectedBorder: HIGHLIGHT_HIGH,
  },
  diagnostics: {
    ok: ROSE,
    warning: GOLD,
    stale: MUTED,
    error: LOVE,
  },
  teleop: {
    actionButton: GOLD,
    actionButtonLight: '#F9D5A2',
    hoverActionButton: '#C99A54',
    planedPath: PINE,
    wayPoint: '#2C6076',
    completedPath: HIGHLIGHT_HIGH,
    openTeleop: GOLD,
    waypointAvatar: FOAM,
  },
  map: {
    point: `${ROSE}E6`,
    pointOutline: HIGHLIGHT_MED,
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
    // Rose robot pose (iris would read as the default theme)
    selectedOutline: ROSE,
    robotPoseNormalPrimary: ROSE,
    robotPoseNormalSecondary: HIGHLIGHT_MED,
    robotPoseNormalOutline: ROSE,
    robotPoseSelectedPrimary: ROSE,
    robotPoseSelectedSecondary: HIGHLIGHT_MED,
    robotPoseSelectedArrow: ROSE,
  },
  joystick: {
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${OVERLAY} 0%, ${SURFACE} 40.82%, ${SHADOW} 59.53%, ${SHADOW} 100%)`,
  },
  severityColor: {
    'SEV 0': '#907aa9',
    'SEV 1': IRIS,
    'SEV 2': '#DBC9F1',
    'SEV 3': '#EFE7F9',
  },
  shadowColor: {
    white: `${TEXT}1A`,
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
    light: OVERLAY,
    main: SURFACE,
    dark: SHADOW,
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

export default rosePineMoon;
