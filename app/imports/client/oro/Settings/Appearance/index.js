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
 * Appearance settings: visual theme selection (a grid of live previews, each
 * rendered under its own theme via nested ThemeProvider), hot-applied and
 * persisted per user.
 */
import React, { useCallback, useRef } from 'react';
import { Box, Link, Tooltip, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { makeStyles } from 'tss-react/mui';
import { capitalize } from 'lodash';
import {
  THEME_NAMES, AUTO_THEME, themeMode, getAutoThemeName, getThemeInstance, setTheme,
  useOroTheme, useThemeSelection,
} from '../../../Styles';
import { useMethod } from '../../util/meteorUtils';
import SampleThemeWidget from './SampleThemeWidget';

const useStyles = makeStyles()(theme => ({
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: theme.palette.text.heading,
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: theme.palette.text.subheading,
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: `1px solid ${theme.palette.background.borderLight}`,
  },
  fieldLabel: {
    fontSize: '13px',
    color: theme.palette.text.detailsLabel,
    marginBottom: '8px',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  card: {
    width: 240,
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    // Same footprint as the selected border so cards don't shift on selection
    border: `2px solid ${theme.palette.background.borderLight}`,
    '&:hover': {
      borderColor: theme.palette.text.secondary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.secondary.main}`,
      outlineOffset: '2px',
    },
  },
  cardSelected: {
    border: `2px solid ${theme.palette.secondary.main} !important`,
  },
}));

const themeLabel = (name) => {
  if (name === AUTO_THEME) {
    return 'Auto (match browser)';
  }
  if (name === 'oro') {
    return 'ORO Moon';
  }
  return name.split('-').map(capitalize).join(' ').replace(/^Oro/, 'ORO').replace(/^Rose Pine/, 'Rosé Pine');
};

// Taglines from each theme's own project; links go to the original source
const THEME_INFO = {
  oro: {
    phrase: 'The ORO default: cool slate, with gold held back for the mark.',
  },
  'oro-sun': {
    phrase: 'ORO for bright floors and printed reports.',
  },
  monokai: {
    phrase: 'The classic warm editor palette by Wimer Hazenberg.',
    url: 'https://monokai.pro',
    site: 'monokai.pro',
  },
  'tokyo-night': {
    phrase: 'A clean theme celebrating the lights of Downtown Tokyo at night.',
    url: 'https://github.com/folke/tokyonight.nvim',
    site: 'folke/tokyonight.nvim',
  },
  'tokyo-day': {
    phrase: 'Tokyo Night’s light "day" variant.',
    url: 'https://github.com/folke/tokyonight.nvim',
    site: 'folke/tokyonight.nvim',
  },
  'catppuccin-mocha': {
    phrase: 'Soothing pastel theme for the high-spirited!',
    url: 'https://catppuccin.com',
    site: 'catppuccin.com',
  },
  'catppuccin-latte': {
    phrase: 'The lightest of the soothing pastel Catppuccin flavors.',
    url: 'https://catppuccin.com',
    site: 'catppuccin.com',
  },
  'rose-pine-moon': {
    phrase: 'All natural pine, faux fur and a bit of soho vibes.',
    url: 'https://rosepinetheme.com',
    site: 'rosepinetheme.com',
  },
  'rose-pine-dawn': {
    phrase: 'Pine, faux fur and soho vibes for the classy minimalist.',
    url: 'https://rosepinetheme.com',
    site: 'rosepinetheme.com',
  },
};

// One radiogroup spanning all rows: Auto first, then dark, then light
const ALL_OPTIONS = [
  AUTO_THEME,
  ...THEME_NAMES.filter((name) => themeMode(name) === 'dark'),
  ...THEME_NAMES.filter((name) => themeMode(name) === 'light'),
];

const Appearance = () => {
  const { classes, cx } = useStyles();
  useOroTheme(); // re-render when the theme changes (e.g. stored preference arriving)
  const selection = useThemeSelection();
  const { call: setUserUi } = useMethod('preferences.setUserUi');
  const cardRefs = useRef({});

  const handleSelect = useCallback(async (name) => {
    setTheme(name); // hot-apply, no reload
    try {
      await setUserUi({ theme: name });
    } catch (err) {
      console.error('Could not save theme preference:', err);
    }
  }, [setUserUi]);

  // Standard radiogroup keyboard behavior: arrows move focus AND selection
  // (roving tabindex; ARIA radios don't get this from the browser)
  const handleKeyDown = useCallback((event, name) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(name);
      return;
    }
    const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!direction) {
      return;
    }
    event.preventDefault();
    const index = ALL_OPTIONS.indexOf(name);
    const next = ALL_OPTIONS[(index + direction + ALL_OPTIONS.length) % ALL_OPTIONS.length];
    handleSelect(next);
    cardRefs.current[next]?.focus();
  }, [handleSelect]);

  const renderCard = (name) => {
    const selected = name === selection;
    // The Auto card previews whatever the browser preference resolves to
    const previewTheme = getThemeInstance(name === AUTO_THEME ? getAutoThemeName() : name);
    const info = THEME_INFO[name];
    const card = (
      <Box
        key={name}
        ref={(el) => { cardRefs.current[name] = el; }}
        className={cx(classes.card, selected && classes.cardSelected)}
        role="radio"
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => handleSelect(name)}
        onKeyDown={(e) => handleKeyDown(e, name)}
      >
        <ThemeProvider theme={previewTheme}>
          <SampleThemeWidget />
          <Box
            sx={(t) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: t.palette.background.paper,
              borderTop: `1px solid ${t.palette.background.borderLight}`,
            })}
          >
            <Typography sx={{ fontSize: '13px', color: 'text.primary' }}>
              {themeLabel(name)}
            </Typography>
            {selected && (
              <CheckCircleIcon sx={{ fontSize: '16px', color: 'secondary.main' }} />
            )}
          </Box>
        </ThemeProvider>
      </Box>
    );
    if (!info) {
      return card;
    }
    return (
      <Tooltip
        key={name}
        enterDelay={400}
        title={(
          <>
            {info.phrase}
            {info.url && (
              <>
                {' '}
                <Link
                  href={info.url}
                  target="_blank"
                  rel="noopener"
                  color="inherit"
                  onClick={(e) => e.stopPropagation()}
                >
                  {info.site}
                </Link>
              </>
            )}
          </>
        )}
      >
        {card}
      </Tooltip>
    );
  };

  return (
    <Box>
      <Typography className={classes.title}>Appearance</Typography>
      <Typography className={classes.subtitle}>
        Personalize how the app looks. Changes apply immediately and are saved
        to your profile.
      </Typography>
      <Box role="radiogroup" aria-label="Theme">
        <Typography className={classes.fieldLabel}>Theme</Typography>
        <Box className={classes.grid}>
          {renderCard(AUTO_THEME)}
        </Box>
        <Typography className={classes.fieldLabel} sx={{ marginTop: '20px' }}>
          Dark themes
        </Typography>
        <Box className={classes.grid}>
          {ALL_OPTIONS.filter((name) => name !== AUTO_THEME && themeMode(name) === 'dark')
            .map(renderCard)}
        </Box>
        <Typography className={classes.fieldLabel} sx={{ marginTop: '20px' }}>
          Light themes
        </Typography>
        <Box className={classes.grid}>
          {ALL_OPTIONS.filter((name) => name !== AUTO_THEME && themeMode(name) === 'light')
            .map(renderCard)}
        </Box>
      </Box>
    </Box>
  );
};

export default Appearance;
