/**
 * FleetControlWidget — Data container
 * Fetches robot data for the selected robot and passes it to the presenter.
 */
import React from 'react';
import PropTypes from 'prop-types';
import useRobots from '../../hooks/useRobots';
import FleetControlWidgetComponent from './FleetControlWidgetComponent';

const FleetControlWidget = ({
  selectedRobotId,
  sortBy,
  robotStatus,
  attributeStatus,
  config,
  onSortBySelected,
  onRobotStatusSelected,
  onAttributeStatusSelected,
  onRobotSelected,
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

FleetControlWidget.defaultProps = {
  selectedRobotId: null,
  sortBy: null,
  robotStatus: null,
  attributeStatus: null,
  config: null,
  onSortBySelected: null,
  onRobotStatusSelected: null,
  onAttributeStatusSelected: null,
  onRobotSelected: null,
};

export default FleetControlWidget;
