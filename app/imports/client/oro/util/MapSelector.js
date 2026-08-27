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
import { useRobotMapsList, mapRefFor, findMapRef } from '../hooks/useRobotMaps';

const MapSelector = ({ robotId, mapSelected, onChange, className }) => {
  const { maps, defaultMap } = useRobotMapsList(robotId);
  if (maps.length < 2) return null;

  const selectedMap = findMapRef(maps, mapSelected, robotId);
  const value = (selectedMap && mapRefFor(selectedMap))
    || (defaultMap && mapRefFor(defaultMap))
    || mapRefFor(maps[0]);

  return (
    <Select
      size="small"
      variant="standard"
      className={className}
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
