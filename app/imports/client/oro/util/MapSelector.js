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

/** Dropdown to switch the Navigation widget between the maps a robot can display. */
import React from 'react';
import PropTypes from 'prop-types';
import { MenuItem, Select } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { Map as MapIcon, ChevronDown } from 'lucide-react';
import classNames from 'classnames';
import { toolbarControl, toolbarControlIcon } from './toolbarControlStyles';
import { useRobotMapsList, mapRefFor, findMapRef } from '../hooks/useRobotMaps';

const useStyles = makeStyles()(theme => ({
  control: {
    ...toolbarControl(theme),
    padding: 0,
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      padding: '0 32px 0 8px !important',
      height: '100%',
      minHeight: 0,
    },
    '& .MuiOutlinedInput-notchedOutline': { border: 'initial' },
    // Same chevron as the robot selector (MuiAutocomplete popupIndicator), centered on the control,
    // with the squared hover of the Actions dropdown button. MUI renders the icon with
    // pointer-events: none; re-enable it so it can hover, and forward mousedown (see ChevronIcon).
    '& .MuiSelect-icon': {
      color: theme.palette.secondary.main,
      top: 'calc(50% - 14px)',
      right: '2px',
      padding: '2px',
      boxSizing: 'content-box',
      pointerEvents: 'auto',
      '&:hover': { backgroundColor: theme.palette.background.onHoverGray },
    },
  },
  icon: { ...toolbarControlIcon(theme), marginLeft: '8px' },
}));

/** Select's icon; opens the menu when pressed by forwarding mousedown to the select element. */
const ChevronIcon = (props) => (
  <ChevronDown
    {...props}
    onMouseDown={(e) => {
      e.preventDefault();
      e.currentTarget.parentElement.querySelector('.MuiSelect-select')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    }}
  />
);

const MapSelector = ({ robotId, mapSelected, onChange, className }) => {
  const { classes } = useStyles();
  const { maps, defaultMap } = useRobotMapsList(robotId);
  if (maps.length < 2) return null;

  const selectedMap = findMapRef(maps, mapSelected, robotId);
  const value = (selectedMap && mapRefFor(selectedMap))
    || (defaultMap && mapRefFor(defaultMap))
    || mapRefFor(maps[0]);

  return (
    <Select
      size="small"
      variant="outlined"
      className={classNames(classes.control, className)}
      startAdornment={<MapIcon className={classes.icon} />}
      IconComponent={ChevronIcon}
      MenuProps={{
        anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
        transformOrigin: { vertical: 'top', horizontal: 'left' },
      }}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      data-test="navdet-controls-map-switcher"
      disabled={!onChange}
    >
      {maps.map((m) => (
        <MenuItem key={mapRefFor(m)} value={mapRefFor(m)}>
          {m.label}{m.entityType === 'system' ? ' (shared)' : ''}
        </MenuItem>
      ))}
    </Select>
  );
};

MapSelector.propTypes = {
  robotId: PropTypes.string,
  mapSelected: PropTypes.string,
  onChange: PropTypes.func,
  className: PropTypes.string,
};

export default MapSelector;
