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
 * Severity Filter Component
 *  - Displays the all the incident severities
 *    and allows the user to toggle the filter on and off
 *
 * Meteor agnostic component
 */
import React from 'react';
import PropTypes from 'prop-types';
import { styled } from '@mui/material/styles';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import { ICM_SEV_ALL } from '../../../../shared/alerts';

const SeverityToggleButton = styled(ToggleButton)(({ theme, value }) => ({
  '&.MuiToggleButton-root': {
    opacity: '0.5',
    fontSize: '0.625rem',
    width: '36px',
    height: '17px',
    padding: '0',
    margin: '0 2px',
    fontWeight: theme.fontWeight.medium,
    borderRadius: '5px',
    border: `1px solid ${theme.palette.severityColor[value]}`,
    backgroundColor: theme.palette.white,
    color: theme.palette.text.content,
    '&:hover': {
      opacity: '0.25',
      backgroundColor: theme.palette.severityColor[value]
    },
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.severityColor[value],
    opacity: 'initial',
    // Black or white, whichever contrasts the chip color in the active theme
    color: theme.palette.getContrastText(theme.palette.severityColor[value]),
    '&:hover': {
      opacity: '0.25',
      backgroundColor: theme.palette.severityColor[value],
    }
  },
  '&:disabled': {
    opacity: '0.5'
  }
}));

/**
 * Renders the Toggle Button with the passed severity
 * @param {string} severity
 */
const severityFilterButton = ({ severity = '', isZeroData }) => {
  return (
    <SeverityToggleButton
      disabled={isZeroData}
      value={severity}
    >
      {severity}
    </SeverityToggleButton>
  );
};

const SeverityFilter = ({ onSeverityChanged, selectedSeverities, isZeroData }) => {
  return ICM_SEV_ALL.map(severity => (
    <ToggleButtonGroup key={severity} onChange={onSeverityChanged} value={selectedSeverities}>
      <SeverityToggleButton
        disabled={isZeroData}
        value={severity}
      >
        {severity}
      </SeverityToggleButton>
    </ToggleButtonGroup>
  ));
};

SeverityFilter.propTypes = {
  onSeverityChanged: PropTypes.func.isRequired,
  selectedSeverities: PropTypes.arrayOf(PropTypes.string)
};

export default SeverityFilter;
