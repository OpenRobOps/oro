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
 * ORO Styles module.
 *
 * Builds the MUI theme from a design-token set (see ./themes/). The initial
 * theme comes from the `theme` URL parameter (e.g. http://.../?theme=monokai,
 * which also overrides the stored user preference) and defaults to the ORO
 * theme. Themes can be hot-applied without reloading via setTheme():
 * App.jsx re-renders through useOroTheme(), and modules importing this
 * module's default export get a live view of the current theme — because of
 * that, never capture nested theme values in module-level constants.
 */
import React, { useSyncExternalStore } from 'react';
import { Meteor } from 'meteor/meteor';
import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { ChevronDown } from 'lucide-react';
import oro from './themes/oro';
import monokai from './themes/monokai';
import tokyoNight from './themes/tokyoNight';
import tokyoDay from './themes/tokyoDay';
import catppuccinMocha from './themes/catppuccinMocha';
import catppuccinLatte from './themes/catppuccinLatte';

const THEMES = {
  oro,
  monokai,
  'tokyo-night': tokyoNight,
  'tokyo-day': tokyoDay,
  'catppuccin-mocha': catppuccinMocha,
  'catppuccin-latte': catppuccinLatte,
};
export const THEME_NAMES = Object.keys(THEMES);

// Optional deployment-wide default, from settings.json:
//   { "public": { "defaultTheme": "monokai" } }
const configuredDefault = Meteor.settings?.public?.defaultTheme;
export const DEFAULT_THEME = THEMES[configuredDefault] ? configuredDefault : 'oro';

const buildTheme = (tokens) => responsiveFontSizes(createTheme({
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Keep the CSS custom properties in styles.css in sync with the theme.
        // Doubled :root wins over the static fallbacks in styles.css regardless
        // of stylesheet order (StyledEngineProvider injectFirst puts these first).
        ':root:root': {
          '--color-background': tokens.background.default,
          '--color-foreground': tokens.text.primary,
          '--color-card': tokens.background.paper,
          '--color-primary': tokens.secondary.main,
          '--color-primary-hover': tokens.background.selected,
          '--color-muted': tokens.text.secondary,
          '--color-border': tokens.background.borderLight,
          '--color-border-gray': tokens.background.borderGray,
          '--color-nav-dark': tokens.background.navDark,
          '--color-button-text': tokens.text.buttonText,
        },
        '& *': {
          // to avoid boxSizing inherit making most of our components smaller
          boxSizing: 'content-box',
          // replace scrollbar styling in all elements
          '&::-webkit-scrollbar': {
            // Total width of the scrollbar
            width: '12px'
          },
          '&::-webkit-scrollbar-thumb': {
            background: tokens.text.secondary,
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
        IconComponent: ChevronDown,
      },
      styleOverrides: {
        icon: {
          color: tokens.secondary.main,
        },
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
          color: tokens.text.bright,
          letterSpacing: '0.01em',
          fontOpticalSizing: 'auto'
        }
      },
      variants: [
        {
          props: { variant: 'errorMessage' },
          style: {
            color: tokens.text.content,
            fontWeight: 400,
            lineHeight: '1.2',
            textAlign: 'center',
          },
        },
        {
          props: { variant: 'errorMessageBold' },
          style: {
            color: tokens.text.content,
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
          backgroundColor: tokens.background.paper,
          color: tokens.text.primary,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.background.paper,
          border: `1px solid ${tokens.background.borderLight}`,
          color: tokens.text.primary,
        },
        // Targets .MuiMenu-list (the <ul> inside the menu).
        list: {
          backgroundColor: tokens.background.paper,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: tokens.background.onHoverGray,
          },
          // Same selected background as Autocomplete options; MUI's default
          // (action.selected) is nearly invisible on light themes
          '&.Mui-selected': {
            backgroundColor: tokens.background.chip,
          },
          '&.Mui-selected:hover': {
            backgroundColor: tokens.background.chip,
          },
        },
      },
    },
    MuiAutocomplete: {
      defaultProps: {
        popupIcon: React.createElement(ChevronDown),
      },
      styleOverrides: {
        paper: {
          backgroundColor: tokens.background.paper,
          border: `1px solid ${tokens.background.borderLight}`,
          color: tokens.text.primary,
        },
        listbox: {
          backgroundColor: tokens.background.paper,
        },
        popper: {
          zIndex: 1300,
        },
        option: {
          fontSize: '14px',
          backgroundColor: tokens.background.paper,
          '&:hover': {
            backgroundColor: `${tokens.background.onHoverGray} !important`,
          },
          '&[aria-selected="true"]': {
            backgroundColor: `${tokens.background.chip} !important`,
          },
        },
        popupIndicator: {
          color: tokens.secondary.main,
        },
        clearIndicator: {
          color: tokens.text.secondary,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: tokens.text.bright,
          borderBottomColor: tokens.background.borderLight,
        },
      },
    },
    MuiTableSortLabel: {
      styleOverrides: {
        root: {
          '&:hover': {
            color: tokens.text.bright,
          },
          '&.Mui-active': {
            color: tokens.text.bright,
          },
          '&.Mui-active .MuiTableSortLabel-icon': {
            color: tokens.text.bright,
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
  palette: tokens,
  fontWeight: {
    bold: 700,
    medium: 500,
    lightMedium: 300,
    lightPlus: 400,
    light: 200
  }
}));

// URL override: handy for testing and sharing links; wins over the stored
// user preference (see ThemePreference in App.jsx)
const requestedTheme = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('theme')
  : null;
export const urlThemeOverride = THEMES[requestedTheme] ? requestedTheme : null;

let currentName = urlThemeOverride || DEFAULT_THEME;
let currentTheme = buildTheme(THEMES[currentName]);
const listeners = new Set();

export const getThemeName = () => currentName;

// Hot-applies a theme: rebuilds the MUI theme and notifies subscribers
export const setTheme = (name) => {
  if (!THEMES[name] || name === currentName) {
    return;
  }
  currentName = name;
  currentTheme = buildTheme(THEMES[name]);
  listeners.forEach((listener) => listener());
};

// React subscription to the current theme; App.jsx re-renders (and MUI
// restyles everything) when setTheme() is called
export const useOroTheme = () => useSyncExternalStore(
  (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  () => currentTheme
);

// Live view of the current theme, for non-React modules that import the theme
// directly (OpenLayers map layers, svg icon modules). Property reads always
// see the active theme. Do NOT capture nested values in module-level
// constants — they would freeze the initial theme's colors.
export default new Proxy({}, {
  get: (_, prop) => currentTheme[prop],
  has: (_, prop) => prop in currentTheme,
  ownKeys: () => Reflect.ownKeys(currentTheme),
  getOwnPropertyDescriptor: (_, prop) => Object.getOwnPropertyDescriptor(currentTheme, prop),
});
