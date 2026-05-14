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
 * ToolBarButtonGroup Component
 *
 * Displays all toolbar buttons, specifying the one that is selected
 * in order to display the requested information.
 * Currently used in:
 *  - ROS Diagnostic toolbar
 */
import PropTypes from 'prop-types';
import { styled } from '@mui/material/styles';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';

const StyledButtonGroup = styled(ToggleButton)(({ theme }) => ({
  '&.MuiToggleButton-root': {
    fontWeight: theme.fontWeight && theme.fontWeight.medium,
    width: 'fit-content',
    minHeight: '50%',
    textTransform: 'capitalize',
    height: '20px',
    fontSize: '12px',
    borderRadius: '5px',
    border: `1px solid ${theme.palette.text.darkBlue}`,
    color: theme.palette.text.title,
    padding: '5px'
  },
  '&.MuiToggleButton-root.Mui-selected': {
    backgroundColor: theme.palette.background.selected,
  },
  '&.MuiToggleButton-root:hover': {
    border: `1px solid ${theme.palette.text.title} !important`,
  }
}));

/**
 * Renders the Toggle Button
 */
const ToolBarButtonGroup = ({
  onButtonChange,
  selectedToolBarButton,
  buttonGroup,
  showLabels = true
}) => (
  <ToggleButtonGroup onChange={onButtonChange} value={selectedToolBarButton} exclusive>
    {buttonGroup.map(({ key, label, icon }) => (
      <StyledButtonGroup
        key={key || label}
        value={key || label}
      >
        {icon}
        {showLabels ? label : null}
      </StyledButtonGroup>
    ))}
  </ToggleButtonGroup>
);

ToolBarButtonGroup.propTypes = {
  onButtonChange: PropTypes.func.isRequired,
  selectedToolBarButton: PropTypes.string,
  buttonGroup: PropTypes.object,
  showLabels: PropTypes.bool
};

export default ToolBarButtonGroup;
