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
import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import {
  Bot,
  BatteryFull,
  Route,
  Tally4,
  LayoutTemplate,
} from 'lucide-react';

const GithubIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const FLOOR_PLAN_ASCII = `    ┌─────────────┬─────────────┐
    │      A      │      B      │
    │     dock    │             │
    └─────   ─────┴─────   ─────┘
    │         corridor          │
    ┌─────   ─────┬─────   ─────┐
    │      C      │      D      │
    │             │     dock    │
    └─────────────┴──────    ───┘`;

const useStyles = makeStyles()(() => ({
  scrollContainer: {
    height: '100%',
    overflowX: 'hidden',
    overflowY: 'auto',
    scrollbarGutter: 'stable',
  },
  root: {
    padding: '40px 26px',
    maxWidth: 983,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    '@media (min-width: 1016px)': {
      padding: '40px 0',
    },
  },
  headerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 600,
    fontSize: 22,
    color: '#FAF0F0',
  },
  headerBody: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 400,
    fontSize: 16,
    lineHeight: '1.6em',
    color: '#D9D9D9',
  },
  link: {
    fontFamily: 'Roboto Mono, monospace',
    color: '#9E6FF3',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  sectionTitle: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 300,
    fontSize: 22,
    color: '#FAF0F0',
  },
  sectionLabel: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    color: '#D9D9D9',
  },
  bodyText: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 400,
    fontSize: 16,
    lineHeight: '1.6em',
    color: '#D9D9D9',
  },
  bodySmall: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 400,
    fontSize: 14,
    lineHeight: '1.6em',
    color: '#E2D8F0',
  },
  monoText: {
    fontFamily: 'Roboto Mono, monospace',
    color: '#9E6FF3',
  },
  monoInline: {
    fontFamily: 'Roboto Mono, monospace',
    lineHeight: '1.6em',
  },
  dashboardsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    borderRadius: 8,
  },
  dashboardCards: {
    display: 'flex',
    gap: 16,
    '@media (max-width: 768px)': {
      flexDirection: 'column',
    },
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1C1131',
    border: '1px solid #403855',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    '&:hover': {
      borderColor: '#9E6FF3',
    },
  },
  statCardTitle: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 400,
    fontSize: 16,
    color: '#FFFFFF',
  },
  simulationWrapper: {
    backgroundColor: '#291F39',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  simulationCard: {
    backgroundColor: '#291F39',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    gap: 32,
    justifyContent: 'center',
  },
  simulationText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  mapActionsRow: {
    display: 'flex',
    gap: 16,
    '@media (max-width: 768px)': {
      flexDirection: 'column',
    },
  },
  mapCard: {
    width: 321,
    flexShrink: 0,
    '@media (max-width: 768px)': {
      width: '100%',
    },
    backgroundColor: '#291F39',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  actionsCard: {
    flex: 1,
    backgroundColor: '#291F39',
    borderRadius: 8,
    padding: 16,
  },
  actionsContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  actionGroup: {
    display: 'flex',
    gap: 24,
    '@media (max-width: 768px)': {
      flexDirection: 'column',
    },
  },
  actionItem: {
    flex: 1,
    borderLeft: '1px solid #9E6FF3',
    paddingLeft: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  actionLabel: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    color: '#D4BBFF',
  },
  actionTags: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 5,
  },
  actionTagRow: {
    display: 'flex',
    gap: 5,
  },
  actionTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    backgroundColor: '#3E3155',
    border: '1px solid #3E3155',
    borderRadius: 8,
  },
  tagText: {
    fontFamily: 'Roboto Mono, monospace',
    fontWeight: 400,
    fontSize: 14,
    color: '#E2D8F0',
  },
  asciiMap: {
    fontFamily: 'Roboto Mono, monospace',
    fontSize: 12,
    lineHeight: '1.4em',
    color: '#BEB6D6',
    margin: 0,
    whiteSpace: 'pre',
  },
  kvCard: {
    backgroundColor: '#291F39',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    gap: 32,
    justifyContent: 'center',
  },
  githubRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
  },
  githubIcon: {
    backgroundColor: '#3E3155',
    borderRadius: 30,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
}));

const WelcomePage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();

  return (
    <Box className={classes.scrollContainer}>
    <Box className={classes.root}>
      {/* Header */}
      <Box className={classes.headerSection}>
        <Typography className={classes.headerTitle}>
          Welcome to your first OpenRobOps dashboard!
        </Typography>
        <Typography className={classes.headerBody}>
          OpenRobOps (ORO) is an open-source robot fleet management and operations platform.
          It provides real-time observability, monitoring, and control for autonomous mobile
          robots (AMRs) — fully self-hostable, with native support for ROS and Open RMF.
          Learn more on{' '}
          <a
            href="https://openrobops.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={classes.link}
          >
            https://openrobops.org/
          </a>
          .
        </Typography>
      </Box>

      {/* Dashboard cards (standalone, no card background) */}
      <Box className={classes.dashboardsSection}>
        <Typography className={classes.bodyText}>
          Monitor and operate your entire fleet through the widgets provided in the dashboards:
        </Typography>
        <Box className={classes.dashboardCards}>
          <Box className={classes.statCard} onClick={() => navigate('/dashboards/fleet')}>
            <Tally4 size={24} color="#E2D8F0" />
            <Typography className={classes.statCardTitle}>Fleet</Typography>
            <Typography className={classes.bodySmall}>
              Overview of all robots in the fleet, their status and fleet-level diagnostics
            </Typography>
          </Box>
          <Box className={classes.statCard} onClick={() => navigate('/dashboards/robot')}>
            <Bot size={24} color="#E2D8F0" />
            <Typography className={classes.statCardTitle}>Robot</Typography>
            <Typography className={classes.bodySmall}>
              Detailed view of a single robot: health, telemetry, reported data, and actions
            </Typography>
          </Box>
          <Box className={classes.statCard} onClick={() => navigate('/dashboards/navigation')}>
            <Route size={24} color="#E2D8F0" />
            <Typography className={classes.statCardTitle}>Navigation</Typography>
            <Typography className={classes.bodySmall}>
              Real-time navigation status and controls
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Simulation wrapper (single #291F39 card containing all simulation content) */}
      <Box className={classes.simulationWrapper}>
        {/* Simulation text */}
        <Box className={classes.simulationCard}>
          <Box className={classes.simulationText}>
            <Typography className={classes.sectionTitle}>Simulation</Typography>
            <Typography className={classes.bodyText} sx={{ fontSize: 18 }}>
              This demonstration instance is set up with a simulated robot{' '}
              <span style={{ fontFamily: 'Roboto Mono, monospace', color: '#FFFFFF' }}>flatland-sim</span>
            </Typography>
            <Typography className={classes.bodyText}>
              It&apos;s a simple 2D simulation running{' '}
              <a href="https://www.ros.org/" target="_blank" rel="noopener noreferrer" className={classes.link}>ROS2</a>.
              It implements the{' '}
              <a href="https://github.com/avidbots/flatland" target="_blank" rel="noopener noreferrer" className={classes.link}>Flatland</a>
              {' '}simulator and the{' '}
              <a href="https://github.com/ros-navigation/navigation2" target="_blank" rel="noopener noreferrer" className={classes.link}>Nav2</a>
              {' '}navigation stack, providing a
              realistic simulation of the robot&apos;s behavior and navigation.
            </Typography>
            <Typography className={classes.bodyText}>
              It also implements a battery plugin that simulates the robot&apos;s battery state,
              which drains rather quickly for demo purposes, and recharges when the robot
              enters a charging zone.
            </Typography>
          </Box>
        </Box>

        {/* Map + Actions row */}
        <Box className={classes.mapActionsRow}>
          <Box className={classes.mapCard}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
              <Typography className={classes.sectionLabel}>Map</Typography>
              <Typography className={classes.bodyText}>
                The map consists of four offices and a central corridor. There are two
                charging zones, in offices A and D.
              </Typography>
            </Box>
            <pre className={classes.asciiMap}>{FLOOR_PLAN_ASCII}</pre>
          </Box>
          <Box className={classes.actionsCard}>
            <Box className={classes.actionsContent}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Typography className={classes.sectionLabel}>Actions</Typography>
                <Typography className={classes.bodyText}>
                  Currently the robot accepts the following commands:
                </Typography>
              </Box>
              <Box className={classes.actionGroup}>
                <Box className={classes.actionItem}>
                  <Box className={classes.actionHeader}>
                    <LayoutTemplate size={24} color="#E2D8F0" />
                    <Typography className={classes.actionLabel}>Dock</Typography>
                  </Box>
                  <Box className={classes.actionTags}>
                    <Box className={classes.actionTagRow}>
                      <Box className={classes.actionTag}>
                        <span className={classes.tagText}>Dock A</span>
                      </Box>
                      <Box className={classes.actionTag}>
                        <span className={classes.tagText}>Dock D</span>
                      </Box>
                    </Box>
                    <Box className={classes.actionTag}>
                      <span className={classes.tagText}>Dock (Nearest)</span>
                    </Box>
                  </Box>
                  <Typography className={classes.bodySmall}>
                    Dock A / D / Nearest: Navigates to the charging zones in office A, D or
                    nearest respectively.
                  </Typography>
                </Box>
                <Box className={classes.actionItem}>
                  <Box className={classes.actionHeader}>
                    <BatteryFull size={24} color="#E2D8F0" />
                    <Typography className={classes.actionLabel}>Battery</Typography>
                  </Box>
                  <Box className={classes.actionTags}>
                    <Box className={classes.actionTag}>
                      <span className={classes.tagText}>Reset</span>
                    </Box>
                    <Box className={classes.actionTagRow}>
                      <Box className={classes.actionTag}>
                        <span className={classes.tagText}>Charging</span>
                      </Box>
                      <Box className={classes.actionTag}>
                        <span className={classes.tagText}>Discharging</span>
                      </Box>
                    </Box>
                  </Box>
                  <Typography className={classes.bodySmall}>
                    Reset: replaces the battery to 100%.
                    <br />
                    Charging/Discharging: toggles the charging state.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Key-value pairs section */}
        <Box className={classes.kvCard}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <Typography className={classes.bodyText}>
              Additionally, the robot reports key-value pairs as custom data elements,
              including{' '}
              <span className={classes.monoInline}>battery_percentage</span> and{' '}
              <span className={classes.monoInline}>battery_voltage</span> for battery state,
              and{' '}
              <span className={classes.monoInline}>estimated_time_remaining</span> from the
              nav2 stack. These are added to other built-in attributes implemented by the
              agent such as CPU usage, disk usage, network rate, etc.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* GitHub footer */}
      <Box className={classes.githubRow}>
        <Box className={classes.githubIcon}>
          <GithubIcon size={32} color="#E2D8F0" />
        </Box>
        <Typography className={classes.bodyText}>
          This simulation is available on{' '}
          <a
            href="https://github.com/OpenRobOps/sim-flatland"
            target="_blank"
            rel="noopener noreferrer"
            className={classes.link}
          >
            GitHub
          </a>{' '}
          to be used as a ready-to-run docker environment which includes the ORO agent as a
          sidecar, ready to connect to OpenRobOps.
        </Typography>
      </Box>
    </Box>
    </Box>
  );
};

export default WelcomePage;
