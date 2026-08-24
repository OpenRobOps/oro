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
    fontFamily: theme.fontFamily.ui,
    fontWeight: 500,
    width: 'fit-content',
    textTransform: 'capitalize',
    height: '19px',
    fontSize: '13px',
    lineHeight: 'normal',
    padding: '2px 8px',
    // Segmented control: square by default; only the outer corners are rounded below.
    borderRadius: 0,
    border: `1px solid ${theme.palette.background.borderLight}`,
    backgroundColor: theme.palette.background.surface,
    color: theme.palette.text.buttonText,
    '&:hover': {
      backgroundColor: theme.palette.background.surface,
      border: `1px solid ${theme.palette.background.borderLight} !important`,
      opacity: 0.7
    },
  },
  '&.MuiToggleButton-root.Mui-selected': {
    color: `${theme.palette.text.primary} !important`,
    opacity: '1 !important',
    backgroundColor: `${theme.palette.background.selected} !important`,
    border: `1px solid ${theme.palette.background.borderLight} !important`,
    '&.Mui-disabled': {
      color: `${theme.palette.text.primary} !important`,
      opacity: '1 !important',
      backgroundColor: `${theme.palette.background.selected} !important`,
    },
  },
  // Round only the outer corners so the group reads as one segmented control.
  '&.MuiToggleButtonGroup-grouped:first-of-type': {
    borderTopLeftRadius: '4px',
    borderBottomLeftRadius: '4px',
  },
  '&.MuiToggleButtonGroup-grouped:last-of-type': {
    borderTopRightRadius: '4px',
    borderBottomRightRadius: '4px',
  },
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
  buttonGroup: PropTypes.array,
  showLabels: PropTypes.bool
};

export default ToolBarButtonGroup;
