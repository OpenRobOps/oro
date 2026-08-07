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
 * Appearance settings: theme selection, hot-applied and persisted per user.
 */
import React, { useCallback } from 'react';
import { Box, Typography, Select, MenuItem } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { capitalize } from 'lodash';
import { THEME_NAMES, DEFAULT_THEME, getThemeName, setTheme, useOroTheme } from '../../../Styles';
import { useMethod } from '../../util/meteorUtils';

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
  select: {
    minWidth: 220,
  },
}));

const themeLabel = (name) => {
  const label = name === 'oro' ? 'ORO' : name.split('-').map(capitalize).join(' ');
  return name === DEFAULT_THEME ? `${label} (default)` : label;
};

const Appearance = () => {
  const { classes } = useStyles();
  useOroTheme(); // re-render when the theme changes (e.g. stored preference arriving)
  const { call: setUserUi } = useMethod('preferences.setUserUi');

  const handleChange = useCallback(async (event) => {
    const name = event.target.value;
    setTheme(name); // hot-apply, no reload
    try {
      await setUserUi({ theme: name });
    } catch (err) {
      console.error('Could not save theme preference:', err);
    }
  }, [setUserUi]);

  return (
    <Box>
      <Typography className={classes.title}>Appearance</Typography>
      <Typography className={classes.subtitle}>
        Personalize how the app looks. Changes apply immediately and are saved
        to your profile.
      </Typography>
      <Typography className={classes.fieldLabel}>Theme</Typography>
      <Select
        className={classes.select}
        value={getThemeName()}
        onChange={handleChange}
      >
        {THEME_NAMES.map((name) => (
          <MenuItem key={name} value={name}>{themeLabel(name)}</MenuItem>
        ))}
      </Select>
    </Box>
  );
};

export default Appearance;
