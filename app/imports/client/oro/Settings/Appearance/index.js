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
import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { makeStyles } from 'tss-react/mui';
import { capitalize } from 'lodash';
import {
  THEME_NAMES, DEFAULT_THEME, getThemeInstance, getThemeName, setTheme, useOroTheme,
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
  const label = name === 'oro' ? 'ORO' : name.split('-').map(capitalize).join(' ');
  return name === DEFAULT_THEME ? `${label} (default)` : label;
};

const Appearance = () => {
  const { classes, cx } = useStyles();
  useOroTheme(); // re-render when the theme changes (e.g. stored preference arriving)
  const themeName = getThemeName();
  const { call: setUserUi } = useMethod('preferences.setUserUi');

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
  const handleKeyDown = useCallback((event, name, index) => {
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
    const next = (index + direction + THEME_NAMES.length) % THEME_NAMES.length;
    handleSelect(THEME_NAMES[next]);
    event.currentTarget.parentElement.children[next]?.focus();
  }, [handleSelect]);

  return (
    <Box>
      <Typography className={classes.title}>Appearance</Typography>
      <Typography className={classes.subtitle}>
        Personalize how the app looks. Changes apply immediately and are saved
        to your profile.
      </Typography>
      <Typography className={classes.fieldLabel}>Theme</Typography>
      <Box className={classes.grid} role="radiogroup" aria-label="Theme">
        {THEME_NAMES.map((name, index) => {
          const selected = name === themeName;
          return (
            <Box
              key={name}
              className={cx(classes.card, selected && classes.cardSelected)}
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => handleSelect(name)}
              onKeyDown={(e) => handleKeyDown(e, name, index)}
            >
              <ThemeProvider theme={getThemeInstance(name)}>
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
        })}
      </Box>
    </Box>
  );
};

export default Appearance;
