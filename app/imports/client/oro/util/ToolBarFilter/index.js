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
 * ToolBarFilterComponent
 *
 * Renders a toolbar with buttons grouped together. It manages the state
 * of the selected button and provides a callback function to handle button changes.
 * If no button is selected, the component selects a button by default
 */
import { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import useMediaQuery from '@mui/material/useMediaQuery';
// InOrbit Modules
import ToolBarButtonGroup from './ToolBarButtonGroup';

const ToolBarFilterComponent = (props) => {
  const {
    setSelectedToolBarButton,
    selectedToolBarButton,
    buttonGroup,
    byDefault,
    showLabels
  } = props;

  useEffect(() => {
    if (!selectedToolBarButton) {
      setSelectedToolBarButton(byDefault);
    }
  }, [selectedToolBarButton, byDefault]);

  // Function to read the button selected by the user
  const onButtonChange = useCallback((event, selectedButton) => {
    setSelectedToolBarButton(selectedButton);
  }, [setSelectedToolBarButton]);

  const isMobile = useMediaQuery('(max-width:800px)');
  return (
    <ToolBarButtonGroup
      onButtonChange={onButtonChange}
      selectedToolBarButton={selectedToolBarButton}
      buttonGroup={buttonGroup}
      showLabels={showLabels && !isMobile}
    />
  );
};

ToolBarFilterComponent.propTypes = {
  buttonGroup: PropTypes.array,
  selectedToolBarButton: PropTypes.string,
  setSelectedToolBarButton: PropTypes.func,
  byDefault: PropTypes.string,
  showLabels: PropTypes.bool
};

export default ToolBarFilterComponent;
