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
 * Display-only sample of themed UI elements (text, severity chips, status
 * colors, an input, a button), used to preview a theme. Render it inside a
 * ThemeProvider with the theme to preview.
 *
 * Only context-based styling (sx / makeStyles) works here — components that
 * import the theme singleton directly would show the active theme instead of
 * the previewed one.
 */
import React from 'react';
import { Box, Paper, Typography, TextField, Button } from '@mui/material';
import { ICM_SEV_ALL } from '../../../../shared/alerts';

const STATUS_KEYS = ['ok', 'warning', 'error', 'resolved'];

const SampleThemeWidget = () => (
  <Box sx={{ bgcolor: 'background.default', p: 1.5, pointerEvents: 'none' }}>
    <Paper
      elevation={0}
      sx={(theme) => ({
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        border: `1px solid ${theme.palette.background.borderLight}`,
        borderRadius: '6px',
      })}
    >
      <Box>
        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: 'text.heading' }}>
          Fleet status
        </Typography>
        <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
          4 robots · 2 on mission
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {ICM_SEV_ALL.map((sev) => (
          <Box
            key={sev}
            component="span"
            sx={(theme) => ({
              backgroundColor: theme.palette.severityColor[sev],
              color: theme.palette.getContrastText(theme.palette.severityColor[sev]),
              fontSize: '10px',
              fontWeight: 500,
              borderRadius: '5px',
              padding: '2px 6px',
              lineHeight: 1.2,
            })}
          >
            {sev}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
        {STATUS_KEYS.map((key) => (
          <Box
            key={key}
            sx={(theme) => ({
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: theme.palette.incidents[key],
            })}
          />
        ))}
        <Typography sx={{ fontSize: '11px', color: 'text.content' }}>
          Incidents
        </Typography>
      </Box>
      <TextField
        type="date"
        size="small"
        defaultValue="2026-08-07"
        slotProps={{ htmlInput: { readOnly: true, tabIndex: -1 } }}
      />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          size="small"
          variant="contained"
          color="secondary"
          tabIndex={-1}
          sx={{ textTransform: 'none', fontSize: '11px', padding: '2px 10px', minWidth: 0 }}
        >
          Approve
        </Button>
        <Typography sx={{ fontSize: '11px', color: 'text.darkBlue' }}>
          Details
        </Typography>
      </Box>
    </Paper>
  </Box>
);

export default SampleThemeWidget;
