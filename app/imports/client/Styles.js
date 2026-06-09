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
 * ORO Styles module — Deep Navy theme.
 *
 * We use this module file to create and export all top level
 * theme and style information for easier re-use.
 */
import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '& *': {
          // to avoid boxSizing inherit making most of our components smaller
          boxSizing: 'content-box',
          // replace scrollbar styling in all elements
          '&::-webkit-scrollbar': {
            // Total width of the scrollbar
            width: '12px'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#BEAEDD',
            borderRadius: '6px',
            // padding-box causes the border of the element to be cut off
            // (along with the background color under it), so by setting the border to a fully
            // transparent color it will cause a padding effect matching the border's width
            // is going to make 6px the total width of the scrollbar:
            // 12px - 3px right border - 3px left border
            // also it's going to create a space of 3px in the top and the bottom of the scrollbar
            border: '3px solid #00000000',
            backgroundClip: 'padding-box'
          }
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        // Breakpoint-specific styles here
        root: {
          '@media (max-width: 900px)': {
            fontSize: '1.2rem',
          }
        }
      }
    },
    MuiButtonBase: {
      styleOverrides: {
        // Breakpoint-specific styles here
        root: {
          // To avoid showing a border when hovering the button
          '&:hover': {
            border: '0 !important'
          },
          '@media (max-width: 900px)': {
            padding: '10px',
          }
        }
      }
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
          color: '#FFFFFF',
          letterSpacing: '0.01em',
          fontOpticalSizing: 'auto'
        }
      },
      variants: [
        {
          props: { variant: 'errorMessage' },
          style: {
            color: '#C2C2C2',
            fontWeight: 400,
            lineHeight: '1.2',
            textAlign: 'center',
          },
        },
        {
          props: { variant: 'errorMessageBold' },
          style: {
            color: '#C2C2C2',
            lineHeight: '1.2',
            textAlign: 'center',
            fontWeight: 500,
          },
        },
      ],
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#170E28',
          color: '#FAF0F0',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#170E28',
          border: '1px solid #3E3155',
          color: '#FAF0F0',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#251A38',
          },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundColor: '#170E28',
          border: '1px solid #3E3155',
          color: '#FAF0F0',
        },
        listbox: {
          backgroundColor: '#170E28',
        },
        popper: {
          zIndex: 1300,
        },
        option: {
          fontSize: '14px',
          backgroundColor: '#170E28',
          '&:hover': {
            backgroundColor: '#251A38 !important',
          },
          '&[aria-selected="true"]': {
            backgroundColor: '#3A285A !important',
          },
        },
        popupIndicator: {
          color: '#BEAEDD',
        },
        clearIndicator: {
          color: '#BEAEDD',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: '#FFFFFF',
          borderBottomColor: '#3E3155',
        },
      },
    },
    MuiTableSortLabel: {
      styleOverrides: {
        root: {
          '&:hover': {
            color: '#FFFFFF',
          },
          '&.Mui-active': {
            color: '#FFFFFF',
          },
          '&.Mui-active .MuiTableSortLabel-icon': {
            color: '#FFFFFF',
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 60,
          '@media (min-width:600px)': {
            minHeight: 60,
          },
        },
      },
    },
  },
  spacing: 8,
  fontFamily: {
    ui: 'Inter, Helvetica, Arial, sans-serif',
    mono: 'DM Mono, monospace',
  },
  palette: {
    mode: 'dark',
    text: {
      // MUI reads these for Typography color="text.primary" / "text.secondary"
      primary: '#FAF0F0',
      secondary: '#BEAEDD',
      icon: '#BEAEDD',
      notesLight: '#BEAEDD',
      title: '#D6CCE8',
      notesMedium: '#BEAEDD',
      notesDark: '#FAF0F0',
      content: '#C2C2C2',
      contrastText: '#FAF0F0',
      darkBlue: '#9E6FF3',
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
      heading: '#E2D8F0',
      subheading: '#A898C4',
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
    teleop: {
      actionButton: '#F05523',
      hoverActionButton: '#C14821',
      planedPath: '#88BF2D',
      wayPoint: '#006B00',
      completedPath: '#2A3C98',
      openTeleop: '#F05523',
      waypointAvatar: '#CFFAEC'
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
    shadowColor: {
      gray: '#00000080',
      white: '#FAF0F01A',
      darkGrayWithOpacity: '#0E09184D'
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
  },
  fontWeight: {
    bold: 700,
    medium: 500,
    lightMedium: 300,
    lightPlus: 400,
    light: 200
  }
});

export default responsiveFontSizes(theme);
