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
 * ORO theme tokens (default theme, "Deep Navy" look).
 *
 * This object is the design-token contract for the app: every color used by
 * components must come from here (through the MUI theme palette). Other themes
 * (see ./monokai.js) override these values keeping the same shape.
 */
const oro = {
  mode: 'dark',
  text: {
    // MUI reads these for Typography color="text.primary" / "text.secondary"
    primary: '#FAF0F0',
    secondary: '#BEAEDD',
    // Default color for body text/table cells (brightest text in the theme)
    bright: '#FFFFFF',
    icon: '#BEAEDD',
    notesLight: '#BEAEDD',
    title: '#D6CCE8',
    notesMedium: '#BEAEDD',
    notesDark: '#FAF0F0',
    content: '#C2C2C2',
    contrastText: '#FAF0F0',
    darkBlue: '#9E6FF3',
    robotAvatar: '#BE9AFF',
    statusError: '#FB7188',
    lightGray: '#C2C2C2',
    mediumDarkGray: '#BEAEDD',
    muted: '#AAAAAA',
    mutedDark: '#585858',
    subtle: '#D0D0D0',
    buttonText: '#D9D9D9',
    inactive: '#9488AA',
    inputLabel: '#757575',
    detailsLabel: '#CAC4D6',
    detailsValue: '#E6E1EE',
    pendingDot: '#EFB8C8',
    onApprove: '#1A004A',
    // Ink for text/icons on background.accentSolid. Every theme must define this
    // explicitly: it is not derivable from the accent (a light theme needs light
    // ink on a saturated fill, a pastel-accent dark theme needs dark ink).
    onAccent: '#1A004A',
    heading: '#E2D8F0',
    subheading: '#A898C4',
    black: '#000000',
  },
  background: {
    default: '#1A0F2E',
    paper: '#170E28',
    blueLightBackground: '#1A0F2E',
    lightBackground: '#1A0F2E',
    tabSelected: '#9E6FF3',
    titleBar: '#170E28',
    spaceIntelligence: '#251A38',
    navLight: '#1A0F2E',
    navMedium: '#170E28',
    navDark: '#0E0918',
    white: '#FFFFFF',
    surface: '#170E28',
    mintAccent: '#5ECFA8',
    mintAccentDim: '#1D4942',
    orangeAccent: '#F4935A',
    orangeAccentDim: '#5F3021',
    lightBlue: '#1A0F2E',
    veryLightGray: '#1A0F2E',
    lightGray: '#251A38',
    gray: '#251A38',
    darkGray: '#251A38',
    black: '#0E0918',
    brightBlue: '#9E6FF3',
    devMagenta: '#9E6FF3',
    loadingBarGray: '#251A38',
    loadingBarTransparentGray: '#251A3800',
    onHoverGray: '#251A38',
    zeroData: '#251A38',
    robOpsCopilotTable: '#1A0F2E',
    softGray: '#1A0F2E',
    borderGray: '#251A38',
    borderLight: '#3E3155',
    borderMedium: '#4A3570',
    chip: '#3A285A',
    selected: '#5C35A8',
    offlineBar: '#F4935A',
    zoneDefaultColor: '#FFCD87',
    accentPurpleHover: '#A78BFA',
    sidebar: '#201533',
    sidebarBorder: '#382B51',
    userCardBg: '#1D1231',
    detailsBorder: '#4A4557',
    pendingBg: 'rgba(99, 59, 72, 0.3)',
    rejectBorder: '#938E9F',
    approveBtn: '#9E6FF3',
    // Fill for accent surfaces that carry text. Usually === secondary.main;
    // overridden where the graphic accent is too light to pass AA behind text
    // (see tokyoDay). NOT for strokes, icons or the logo wedge — those use
    // secondary.main, which stays at full brightness.
    accentSolid: '#9E6FF3',
    selectedNav: '#341F5A',
  },
  modes: {
    mission: '#5ECFA8',
    idle: '#A139C3',
    error: '#B41270',
    charging: '#BA8A27',
    others: '#BCBCBC',
    modeBrown: '#BB8900',
    modeBlue: '#507CCF'
  },
  incidents: {
    ok: '#3F93FF',
    resolved: '#4CAF50',
    warning: '#FFBB32',
    error: '#FB7188',
    inactive: '#BCBCBC',
    staleOk: '#B2D3FF',
    staleWarning: '#FFE3AD',
    staleError: '#EAAD9A',
    staleInactive: '#E4E4E4',
    // Used for disabling data sources according to mode.
    disabled: '#f3f3f3',
    disabledSelected: '#2b2e82',
    selectedBorder: '#2A3C98',
  },
  // ROS diagnostics status colors (see graphics/ROSDiagnosticIcon)
  diagnostics: {
    ok: '#3F93FF',
    warning: '#FFBB32',
    stale: '#BCBCBC',
    error: '#CB3303',
  },
  teleop: {
    actionButton: '#F05523',
    actionButtonLight: '#F5834E',
    hoverActionButton: '#C14821',
    planedPath: '#88BF2D',
    wayPoint: '#006B00',
    completedPath: '#2A3C98',
    openTeleop: '#F05523',
    waypointAvatar: '#CFFAEC'
  },
  // Localization map layers (see LocalizationWidget)
  map: {
    point: '#8080FFE6',
    pointOutline: '#404080',
    selected: '#71BAE1',
    relocalizeDrag: {
      color: '#5ECFA84D',
      stroke: '#5ECFA8',
      strokeWidth: '5',
    },
    relocalizeRotate: {
      color: '#5ECFA8',
      stroke: '#5ECFA8',
      strokeWidth: '3',
    },
    relocalizeInnerFrame: '#BE9AFF',
    selectedOutline: '#8080FF',
    robotPoseNormalPrimary: '#BE9AFF',
    robotPoseNormalSecondary: '#3E3155',
    robotPoseNormalOutline: '#BE9AFF',
    robotPoseSelectedPrimary: '#BE9AFF',
    robotPoseSelectedSecondary: '#3E3155',
    robotPoseSelectedArrow: '#BE9AFF'
  },
  // Teleop joystick gradients (see NavigationJoystick)
  joystick: {
    light: 'radial-gradient(113.54% 113.54% at 40.33% 15.25%, #FFFFFF 0%, #FAFAFA 26.38%, #ECECEC 57.1%, #D5D5D5 89.86%, #CCCCCC 100%)',
    darkInner: 'radial-gradient(113.31% 113.31% at 59.66% 84.68%, #1A1230 0%, #150E26 21.38%, #110B1F 40.82%, #0E0918 59.53%, #0E0918 100%)',
    lightInner: 'radial-gradient(113.31% 113.31% at 59.66% 84.68%, #FFFFFF 0%, #FBFBFB 21.38%, #F0F0F0 40.82%, #DEDEDE 59.53%, #C4C4C4 77.77%, #A3A3A3 95.52%, #999999 100%)',
  },
  severityColor: {
    'SEV 0': '#700893',
    'SEV 1': '#A335C8',
    'SEV 2': '#DA80F9',
    'SEV 3': '#F1CAFF',
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
    stepwise: '#88BF2D',
    teleop: '#F4935A'
  },
  cameras: {
    delayTime: '#FFBB32'
  },
  icons: {
    lightGray: '#BEAEDD',
    neutral: '#666666',
    bigIcon: '60px',
    mediumIcon: '40px',
    smallIcon: '20px'
  },
  primary: {
    lighter: '#1A0F2E',
    light: '#251A38',
    main: '#170E28',
    dark: '#0E0918',
    contrastDefaultColor: 'light',
    contrastText: '#FAF0F0'
  },
  secondary: {
    main: '#9E6FF3',
  },
  laserPoints: {
    primary: '#3993FFCC',
    secondary: '#B41270CC',
    tertiary: '#BB8900CC'
  },
  zeroData: {
    softBlue: '#9AC2F7',
    gray: '#E1E1E1',
    softPink: '#DB90C0',
    softOrange: '#FDC6B0',
    darkBlue: '#2678B2',
    lightBlue: '#C3C4E0',
    orangeLighter: '#F7D69B'
  },
  boxShadow: {
    light: '#0000007f',
    white: '#faf0f019'
  },
  zone: {
    defaultColor: '#FFCD87'
  },
  snackbar: {
    success: '#43A047',
    error: '#e53935',
    info: '#1E88E5',
    warning: '#FFA000',
  },
  copilotContextChips: {
    color: '#9E6FF3',
    bg: '#9E6FF314',
    hoverBg: '#9E6FF329',
  }
};

export default oro;
