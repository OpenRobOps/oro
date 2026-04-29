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
 * FleetControlWidgetComponent: Control bar for fleet sections.
 * Allows users to filter by robot status, sort the fleet, and see the selected robot.
 */
import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { Button, Grid, Typography } from '@mui/material';
import {
  FormatListBulleted,
  AddCircle,
  Settings,
  Cancel,
} from '@mui/icons-material';
import FleetControlWidgetOptionsComponent from './OptionComponents/FleetControlWidgetOptionsComponent';
import { SORT_BY, SORT_BY_LABELS } from './OptionComponents/SortByComponent';
import {
  FLAG_ERROR, FLAG_WARNING, FLAG_OK, FLAG_OFFLINE, DEFAULT_FLAGS_STRING,
} from '../fleetFilteringUtil';

const STATUS_FLAG_LABELS = {
  [FLAG_ERROR]: 'Error',
  [FLAG_WARNING]: 'Warning',
  [FLAG_OK]: 'OK',
  [FLAG_OFFLINE]: 'Offline',
};

const useStyles = makeStyles()(theme => ({
  fleetControlContainer: {
    background: theme.palette.background.surface,
    border: `1px solid ${theme.palette.background.borderLight}`,
    borderRadius: '10px',
    position: 'relative',
    margin: '0px',
    zIndex: 6,
  },
  fleetControl: {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    flexWrap: 'nowrap',
    width: '100%',
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  filterChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '24.6px',
    padding: '0 7px',
    borderRadius: '4px',
    background: theme.palette.background.borderLight,
    border: `1px solid ${theme.palette.background.borderLight}`,
    cursor: 'pointer',
    flexShrink: 0,
    userSelect: 'none',
  },
  filterChipLabel: {
    fontSize: '13px',
    fontWeight: 400,
    fontFamily: '"Inter", sans-serif',
    color: theme.palette.text.buttonText,
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
  },
  filterChipX: {
    fontSize: '16px !important',
    color: theme.palette.text.buttonText,
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  iconTextButton: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    padding: 0,
    minWidth: 'unset',
    textTransform: 'none',
    color: theme.palette.text.buttonText,
    height: '24px',
    '&:hover': {
      background: 'transparent',
      color: theme.palette.text.primary,
    },
    '&.Mui-disabled': {
      color: alpha(theme.palette.text.buttonText, 0.35),
    },
  },
  buttonIcon: {
    fontSize: '20px !important',
  },
  buttonText: {
    fontSize: '12px',
    fontWeight: 400,
    color: 'inherit',
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
  },
  settingsIcon: {
    fontSize: '24px !important',
    color: theme.palette.text.buttonText,
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
}));

const FleetControlWidgetComponent = ({
  sortBy = SORT_BY.IMPORTANCE,
  robotStatus,
  attributeStatus,
  config,
  selectedRobotId,
  robot,
  onSortBySelected,
  onRobotStatusSelected,
  onAttributeStatusSelected,
  onRobotSelected,
}) => {
  const { classes } = useStyles();
  const [showingOptions, setShowingOptions] = useState(false);

  const toggleShowingOptions = useCallback(() => {
    setShowingOptions(prev => !prev);
  }, []);

  const closeOptions = useCallback(() => {
    setShowingOptions(false);
  }, []);

  const handleSortChipKeyDown = useCallback((e) => {
    if (e.key === 'Enter') toggleShowingOptions();
  }, [toggleShowingOptions]);

  const handleClearStatus = useCallback((e) => {
    e.stopPropagation();
    onRobotStatusSelected(null);
  }, [onRobotStatusSelected]);

  const handleClearComponent = useCallback((e) => {
    e.stopPropagation();
    onAttributeStatusSelected(null);
  }, [onAttributeStatusSelected]);

  // Sort by chip label
  const sortByLabel = useMemo(() => {
    if (selectedRobotId && robot?.name) {
      return `Robot: ${robot.name}`;
    }
    const sortByObj = SORT_BY_LABELS.find(item => item._id === (sortBy || SORT_BY.IMPORTANCE));
    return sortByObj ? sortByObj.label : 'Sort by Status';
  }, [sortBy, selectedRobotId, robot]);

  // Status filter chip: shown when robotStatus is set and not the default (all flags)
  const hasStatusFilter = robotStatus && robotStatus !== DEFAULT_FLAGS_STRING;
  const statusFilterLabel = useMemo(() => {
    if (!hasStatusFilter) return null;
    const activeLabels = [FLAG_ERROR, FLAG_WARNING, FLAG_OK, FLAG_OFFLINE]
      .filter(f => robotStatus && robotStatus.includes(f))
      .map(f => STATUS_FLAG_LABELS[f]);
    return activeLabels.length ? `Filter by ${activeLabels.join(', ')}` : null;
  }, [hasStatusFilter, robotStatus]);

  // Component filter chip
  const selectedComponentId = attributeStatus ? Object.keys(attributeStatus)[0] : null;
  const selectedComponentLabel = selectedComponentId
    ? (config?.elementValues?.[selectedComponentId]?.label || selectedComponentId)
    : null;

  return (
    <Grid container className={classes.fleetControlContainer}>
      <Grid container className={classes.fleetControl}>
        {/* Left group: active filter chips + Options + New Robot */}
        <Grid item className={classes.leftGroup}>
          {/* Sort by chip: always shown */}
          <div
            className={classes.filterChip}
            onClick={toggleShowingOptions}
            role="button"
            tabIndex={0}
            onKeyDown={handleSortChipKeyDown}
          >
            <Typography className={classes.filterChipLabel}>{sortByLabel}</Typography>
          </div>
          {/* Status filter chip — shown when a status subset is active */}
          {hasStatusFilter && statusFilterLabel && (
            <div className={classes.filterChip} role="button" tabIndex={0}>
              <Typography className={classes.filterChipLabel}>{statusFilterLabel}</Typography>
              <Cancel className={classes.filterChipX} onClick={handleClearStatus} />
            </div>
          )}
          {/* Component filter chip: shown when attributeStatus is set */}
          {selectedComponentLabel && (
            <div className={classes.filterChip} role="button" tabIndex={0}>
              <Typography className={classes.filterChipLabel}>{selectedComponentLabel}</Typography>
              <Cancel className={classes.filterChipX} onClick={handleClearComponent} />
            </div>
          )}
          {/* Options button */}
          <Button className={classes.iconTextButton} onClick={toggleShowingOptions} disableRipple>
            <FormatListBulleted className={classes.buttonIcon} />
            <Typography className={classes.buttonText}>Options</Typography>
          </Button>
          {/* New Robot button: disabled for now */}
          <Button
            data-test="add-a-robot-button"
            className={classes.iconTextButton}
            disabled
            disableRipple
          >
            <AddCircle className={classes.buttonIcon} />
            <Typography className={classes.buttonText}>New Robot</Typography>
          </Button>
        </Grid>
        {/* Right group: settings icon */}
        <Grid item>
          <Settings className={classes.settingsIcon} onClick={toggleShowingOptions} />
        </Grid>
      </Grid>
      {showingOptions && (
        <FleetControlWidgetOptionsComponent
          onClose={closeOptions}
          sortBy={sortBy}
          onSortBySelected={onSortBySelected}
          robotStatus={robotStatus}
          onRobotStatusSelected={onRobotStatusSelected}
          attributeStatus={attributeStatus}
          onAttributeStatusSelected={onAttributeStatusSelected}
          config={config}
        />
      )}
    </Grid>
  );
};

FleetControlWidgetComponent.propTypes = {
  sortBy: PropTypes.string,
  robotStatus: PropTypes.string,
  attributeStatus: PropTypes.object,
  config: PropTypes.object,
  selectedRobotId: PropTypes.string,
  robot: PropTypes.object,
  onSortBySelected: PropTypes.func,
  onRobotStatusSelected: PropTypes.func,
  onAttributeStatusSelected: PropTypes.func,
  onRobotSelected: PropTypes.func,
};

export default FleetControlWidgetComponent;
