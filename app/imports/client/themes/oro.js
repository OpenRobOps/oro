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
 * ORO Moon theme tokens (default theme, dark).
 *
 * From the "ORO Product Theme" brand canvas: cool slate neutrals carry every
 * surface; gold is the brand accent and is held back for the mark, selected
 * state and the one primary action on a screen; teal does the interactive
 * work (links, section headings, chevrons); violet carries second-position
 * data; status owns green, blue, orange and red.
 *
 * This object is the design-token contract for the app: every color used by
 * components must come from here (through the MUI theme palette). Other themes
 * (see ./oroSun.js, ./monokai.js) override these values keeping the same shape.
 */

// Surfaces
const BG = '#151824';
const PAPER = '#1B1F2D';
const DEEP = '#0F1119';
const SIDEBAR = '#191D29';
const CHIP = '#262B3B';
const BORDER = '#2F3546';
const BORDER_STRONG = '#3D445A';
// Text
const FG = '#EDF0F6';
const FG_SOFT = '#CBD2DE';
const FG2 = '#AEB6C6';
const MUTED = '#909AAE';
const MUTED_DARK = '#5E6777';
// Brand accent (mark, selected, primary action) and its hover/ink
const GOLD = '#E0A526';
const GOLD_HOVER = '#EAB84A';
const GOLD_PALE = '#F2CB7A';
const ON_GOLD = '#241703';
// Supporting accents
const TEAL = '#3FB6C4';
const VIOLET = '#8B7DE8';
// Status
const GREEN = '#45B87A';
const GREEN_DEEP = '#2E9C63';
const BLUE = '#5B8DEF';
const ORANGE = '#E8763C';
const RED = '#E4526A';

const oro = {
  mode: 'dark',
  text: {
    // MUI reads these for Typography color="text.primary" / "text.secondary"
    primary: FG,
    secondary: FG2,
    // Default color for body text/table cells (brightest text in the theme)
    bright: FG,
    icon: FG2,
    notesLight: FG2,
    title: FG_SOFT,
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
    mutedDark: MUTED_DARK,
    subtle: FG_SOFT,
    buttonText: FG2,
    inactive: MUTED,
    inputLabel: MUTED,
    detailsLabel: FG2,
    detailsValue: FG,
    pendingDot: '#F2A98A',
    onApprove: ON_GOLD,
    // Ink for text/icons on background.accentSolid. Every theme must define this
    // explicitly: it is not derivable from the accent (a light theme needs light
    // ink on a saturated fill, a pastel-accent dark theme needs dark ink).
    onAccent: ON_GOLD,
    heading: FG,
    subheading: FG2,
    black: '#000000',
  },
  background: {
    default: BG,
    paper: PAPER,
    blueLightBackground: BG,
    lightBackground: BG,
    tabSelected: GOLD,
    titleBar: PAPER,
    spaceIntelligence: CHIP,
    navLight: BG,
    navMedium: PAPER,
    navDark: DEEP,
    white: '#FFFFFF',
    surface: PAPER,
    mintAccent: GREEN,
    mintAccentDim: '#1C4A34',
    orangeAccent: ORANGE,
    orangeAccentDim: '#5A2E18',
    lightBlue: BG,
    veryLightGray: BG,
    lightGray: CHIP,
    gray: CHIP,
    darkGray: CHIP,
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
    // Dim teal: selected toolbar/segment background behind light text
    selected: '#1E5560',
    offlineBar: ORANGE,
    zoneDefaultColor: GOLD_PALE,
    accentPurpleHover: GOLD_HOVER,
    sidebar: SIDEBAR,
    sidebarBorder: BORDER,
    userCardBg: PAPER,
    detailsBorder: BORDER_STRONG,
    pendingBg: 'rgba(232, 118, 60, 0.15)',
    rejectBorder: MUTED,
    approveBtn: GOLD,
    // Fill for accent surfaces that carry text. Usually === secondary.main;
    // overridden where the graphic accent is too light to pass AA behind text
    // (see tokyoDay). NOT for strokes, icons or the logo wedge — those use
    // secondary.main, which stays at full brightness.
    accentSolid: GOLD,
    selectedNav: CHIP,
  },
  modes: {
    mission: GREEN,
    idle: VIOLET,
    error: RED,
    charging: '#C9931F',
    others: MUTED,
    modeBrown: '#B07A10',
    modeBlue: BLUE,
  },
  incidents: {
    ok: GREEN,
    resolved: GREEN_DEEP,
    warning: ORANGE,
    error: RED,
    inactive: MUTED,
    staleOk: '#A3D9BB',
    staleWarning: '#F3BBA0',
    staleError: '#F0A9B5',
    staleInactive: '#C8CED9',
    // Used for disabling data sources according to mode.
    disabled: '#f3f3f3',
    disabledSelected: '#2b2e82',
    selectedBorder: TEAL,
  },
  // ROS diagnostics status colors (see graphics/ROSDiagnosticIcon)
  diagnostics: {
    ok: GREEN,
    warning: ORANGE,
    stale: MUTED,
    error: RED,
  },
  teleop: {
    actionButton: ORANGE,
    actionButtonLight: '#F0956A',
    hoverActionButton: '#C45E2C',
    planedPath: GREEN,
    wayPoint: GREEN_DEEP,
    completedPath: '#3B62B8',
    openTeleop: ORANGE,
    waypointAvatar: '#CFF5E2',
  },
  // Localization map layers (see LocalizationWidget)
  map: {
    point: `${VIOLET}E6`,
    pointOutline: '#4A4390',
    selected: TEAL,
    relocalizeInnerFrame: TEAL,
    selectedOutline: VIOLET,
    robotPoseNormalPrimary: TEAL,
    robotPoseNormalSecondary: BORDER,
    robotPoseNormalOutline: TEAL,
    robotPoseSelectedPrimary: GOLD,
    robotPoseSelectedSecondary: BORDER,
    robotPoseSelectedArrow: GOLD,
  },
  // Teleop joystick gradients (see NavigationJoystick)
  joystick: {
    light: 'radial-gradient(113.54% 113.54% at 40.33% 15.25%, #FFFFFF 0%, #FAFAFA 26.38%, #ECECEC 57.1%, #D5D5D5 89.86%, #CCCCCC 100%)',
    darkInner: `radial-gradient(113.31% 113.31% at 59.66% 84.68%, ${PAPER} 0%, ${BG} 21.38%, #12141F 40.82%, ${DEEP} 59.53%, ${DEEP} 100%)`,
    lightInner: 'radial-gradient(113.31% 113.31% at 59.66% 84.68%, #FFFFFF 0%, #FBFBFB 21.38%, #F0F0F0 40.82%, #DEDEDE 59.53%, #C4C4C4 77.77%, #A3A3A3 95.52%, #999999 100%)',
  },
  severityColor: {
    'SEV 0': '#4A3FA8',
    'SEV 1': VIOLET,
    'SEV 2': '#B3A9F2',
    'SEV 3': '#DAD5FA',
  },
  tags: {
    skyBlue: '#63B1DC',
    greenBlue: '#66C2A5',
    poloBlue: '#8DA0CB',
    lightOrange: '#FC8D62',
    yellow: '#FFD92F',
    pink: '#E78AC3',
    lightBeige: '#E5C494'
  },
  teleopArrows: {
    darkBackground: '#2B2B2B',
    lightBackground: '#ECECEC',
    baseArrow: '#B9B9B9',
    darkModeArrow: '#696969',
    stepwise: GREEN,
    teleop: ORANGE,
  },
  cameras: {
    delayTime: ORANGE,
  },
  icons: {
    lightGray: FG2,
    neutral: MUTED_DARK,
    bigIcon: '60px',
    mediumIcon: '40px',
    smallIcon: '20px'
  },
  primary: {
    lighter: BG,
    light: CHIP,
    main: PAPER,
    dark: DEEP,
    contrastDefaultColor: 'light',
    contrastText: FG,
  },
  // Graphic accent: strokes, icons, selected borders and the logo wedge.
  secondary: {
    main: GOLD,
  },
  laserPoints: {
    primary: `${TEAL}CC`,
    secondary: `${VIOLET}CC`,
    tertiary: `${GOLD}CC`,
  },
  zeroData: {
    softBlue: '#9AB8F5',
    gray: '#DDE1E8',
    softPink: '#D9A0C9',
    softOrange: '#F5C4A8',
    darkBlue: BLUE,
    lightBlue: '#C3CBE0',
    orangeLighter: GOLD_PALE,
  },
  boxShadow: {
    light: '#0000007f',
    white: `${FG}19`,
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
  }
};

export default oro;
