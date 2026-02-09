/**
 * ORO Styles module.
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
            background: '#C7C7C7',
            borderRadius: '6px',
            // padding-box causes the border of the element to be cut off
            // (along with the background color under it), so by setting the border to a fully
            // transparent color it will cause a padding effect matching the border's width
            // is going to make 6px the total width of the scrollbar:
            // 12px - 3px right border - 3px left border
            // also it's going to create a space of 3px in the top and the bottom of the scrollbar
            border: '3px solid rgba(0, 0, 0, 0)',
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
        // Beakpoint-specific styles here
        root: {
          '@media (max-width: 900px)': {
            fontSize: '1.2rem', // Adjust the size for screens with a maximum width of 900px
          }
        }
      }
    },
    MuiButtonBase: {
      styleOverrides: {
        // Beakpoint-specific styles here
        root: {
          // To avoid showing a dark blue border when hovering the button
          '&:hover': {
            border: '0 !important'
          },
          '@media (max-width: 900px)': {
            padding: '10px', // Adjust the size for screens with a maximum width of 900px
          }
        }
      }
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
        }
      },
      variants: [
        {
          props: { variant: 'errorMessage' },
          style: {
            color: '#666666',
            fontWeight: 400,
            lineHeight: '1.2',
            textAlign: 'center',
          },
        },
        {
          props: { variant: 'errorMessageBold' },
          style: {
            color: '#666666',
            lineHeight: '1.2',
            textAlign: 'center',
            fontWeight: 500,
          },
        },
      ],
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
  palette: {
    text: {
      icon: '#D7D7D7',
      notesLight: '#BCBCBC',
      title: '#666666',
      notesMedium: '#454545',
      notesDark: '#333333',
      content: '#000000',
      contrastText: '#FFFFFF',
      darkBlue: '#2A3C98',
      statusError: '#CB3303',
      lightGray: '#ADADAD',
      mediumDarkGray: '#757575'
    },
    background: {
      blueLightBackground: '#DEEAF7',
      lightBackground: '#E7EEF6',
      tabSelected: '#71777E',
      titleBar: '#282967',
      spaceIntelligence: '#595959',
      navLight: '#606060',
      navMedium: '#303030',
      navDark: '#434343',
      white: '#FFFFFF',
      lightBlue: '#F5FAFF',
      veryLightGray: '#f2f2f2',
      lightGray: '#E8E8E8',
      gray: '#D7D7D7',
      darkGray: '#3E3E3E',
      black: '#000000',
      brightBlue: '#3F93FF',
      devMagenta: '#C83596',
      loadingBarGray: '#E1E1E1',
      loadingBarTransparentGray: '#E1E1E100',
      onHoverGray: '#DBDBDB',
      zeroData: '#EBEBEB',
      robOpsCopilotTable: '#DEEAF7',
      softGray: '#F5F5F5',
      borderGray: '#DDDDDD',
      zoneDefaultColor: '#FFCD87'
    },
    modes: {
      mission: '#0E77BA',
      idle: '#00B3D8',
      error: '#B41270',
      charging: '#D5BD07',
      others: '#7D9297',
      modeBrown: '#BB8900',
      modeBlue: '#507CCF'
    },
    incidents: {
      ok: '#3F93FF',
      warning: '#FFBB32',
      error: '#CB3303',
      inactive: '#BCBCBC',
      staleOk: '#B2D3FF',
      staleWarning: '#FFE3AD',
      staleError: '#EAAD9A',
      staleInactive: '#E4E4E4',
      // Used for disabling data sources according to mode.
      disabled: '#f3f3f3',
      disabledSelected: '#2b2e82',
    },
    teleop: {
      actionButton: '#F05523',
      hoverActionButton: '#C14821',
      planedPath: '#88BF2D',
      wayPoint: '#006B00',
      completedPath: '#2A3C98',
      openTeleop: '#F05523',
      waypointAvatar: 'transparent'
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
      gray: 'rgba(0, 0, 0, 0.3)',
      white: 'rgba(255, 255, 255, 0.5)',
      darkGrayWithOpacity: 'rgba(87, 90, 91, 0.1)'
    },
    teleopArrows: {
      darkBackground: '#2B2B2B',
      lightBackground: '#ECECEC',
      baseArrow: '#B9B9B9',
      darkModeArrow: '#696969',
      stepwise: '#88BF2D',
      teleop: '#F05523'
    },
    cameras: {
      delayTime: '#FFBB32'
    },
    icons: {
      lightGray: '#B2B2B2',
      bigIcon: '60px',
      mediumIcon: '40px',
      smallIcon: '20px'
    },
    primary: { // blues
      lighter: '#edeef9',
      light: '#C6C9E5', // Lighter Blue
      main: '#2A3C98', // text.darkBlue
      dark: '#282967', // background.titleBar
      contrastDefaultColor: 'light',
      contrastText: '#fff'
    },
    secondary: {
      main: '#F05523', // used in checkboxs in Settings
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
      light: '#0000004d',
      white: '#ffffff80'
    },
    zone: {
      defaultColor: '#FFCD87'
    },
    copilotContextChips: {
      color: '#1976D2',
      bg: '#1976D214',
      hoverBg: '#1976D229',
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
