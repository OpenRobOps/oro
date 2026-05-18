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
 * FleetControlWidget — Data container
 * Fetches robot data for the selected robot and passes it to the presenter.
 */
import React from 'react';
import PropTypes from 'prop-types';
import useRobots from '../../hooks/useRobots';
import FleetControlWidgetComponent from './FleetControlWidgetComponent';

const FleetControlWidget = ({
  selectedRobotId = null,
  sortBy = null,
  robotStatus = null,
  attributeStatus = null,
  config = null,
  onSortBySelected = null,
  onRobotStatusSelected = null,
  onAttributeStatusSelected = null,
  onRobotSelected = null,
}) => {
  const { robotsById } = useRobots();
  const robot = selectedRobotId ? robotsById[selectedRobotId] : null;

  return (
    <FleetControlWidgetComponent
      selectedRobotId={selectedRobotId}
      sortBy={sortBy}
      robotStatus={robotStatus}
      attributeStatus={attributeStatus}
      config={config}
      robot={robot}
      onSortBySelected={onSortBySelected}
      onRobotStatusSelected={onRobotStatusSelected}
      onAttributeStatusSelected={onAttributeStatusSelected}
      onRobotSelected={onRobotSelected}
    />
  );
};

FleetControlWidget.propTypes = {
  selectedRobotId: PropTypes.string,
  sortBy: PropTypes.string,
  robotStatus: PropTypes.string,
  attributeStatus: PropTypes.object,
  config: PropTypes.object,
  onSortBySelected: PropTypes.func,
  onRobotStatusSelected: PropTypes.func,
  onAttributeStatusSelected: PropTypes.func,
  onRobotSelected: PropTypes.func,
};


export default FleetControlWidget;
