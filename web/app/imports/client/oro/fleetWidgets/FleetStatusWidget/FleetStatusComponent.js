/**
 * Fleet Status Component
 *
 * Displays a fleet of robots with status labels on the left and
 * status stacks per robot on the right. Robots can be clicked for selection.
 */

import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
// Oro modules
import StatusStack from './StatusStack';
import StatusList from './StatusList';
import { sortRobotsByStatus } from '../../../../lib/status';
import { fleetFilterFunction } from '../fleetFilteringUtil';

const SORT_BY = {
  IMPORTANCE: 'i',
  NAME: 'n'
};

const SORT_BY_LABELS = [
  {
    label: 'Sort by Status',
    _id: SORT_BY.IMPORTANCE
  },
  {
    label: 'Sort by Name',
    _id: SORT_BY.NAME
  }
];

const useStyles = makeStyles()(theme => ({
  gridContainer: {
    padding: '0.5rem',
    width: '100%',
  },
  fleetContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: '0.1em',
    height: '100%',
    overflowY: 'hidden'
  },
  leftColumn: {
    minWidth: theme.spacing(13.2),
    marginRight: '8px'
  },
  loadingContainer: {
    opacity: 0.6
  },
  stackContainer: {
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    height: '100%',
    '& > div:first-of-kind': {
      marginLeft: '0.4em'
    },
    '& > div:last-child': {
      marginRight: '0.4em'
    }
  }
}));

const sortRobots = (robots, statusList, sortBy) => {
  switch (sortBy) {
    case SORT_BY.NAME:
      return robots.sort((a, b) => (
        (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
      ));
    default:
      return sortRobotsByStatus(robots, statusList);
  }
};

const FleetStatusComponent = ({
  isLoading,
  robotId,
  robots,
  statusList = [],
  statusValues = {},
  sortBy,
  robotStatus,
  attributeStatus,
  onRobotSelected,
  getRobotDetailedStatus,
}) => {
  const { classes } = useStyles();

  const sortedRobots = useMemo(() => {
    const filterFunction = fleetFilterFunction({ robotStatus, attributeStatus });
    const filteredRobots = robots?.filter(filterFunction);
    return sortRobots(filteredRobots || [], statusList, sortBy);
  }, [robots, statusList, sortBy, robotStatus, attributeStatus]);

  const handleGetStatusMessage = useCallback((callerProps, cb) => {
    if (cb) {
      const { robotId: robotIdForStatus, attributeId } = callerProps;
      if (robotIdForStatus && attributeId) {
        cb('...');
        getRobotDetailedStatus({ robotId: robotIdForStatus, attributeId, cb });
      }
    }
  }, [getRobotDetailedStatus]);

  const robotSelectCallback = useCallback((robot = {}) => {
    if (robotId === robot._id) {
      onRobotSelected();
    } else {
      onRobotSelected(robot._id);
    }
  }, [onRobotSelected, robotId]);

  return (
    <div className={classes.gridContainer}>
      <div className={classes.fleetContainer}>
        <div className={classes.leftColumn}>
          <StatusList
            statusList={statusList}
            statusValues={statusValues}
          />
        </div>
        <div className={isLoading ? classes.loadingContainer : classes.stackContainer}>
          {sortedRobots && sortedRobots.map((robot) => {
            const selected = robot._id === robotId;
            return (
              <StatusStack
                key={robot._id}
                selected={selected}
                robot={robot}
                statuses={robot.statuses}
                statusList={statusList}
                robotSelectCallback={robotSelectCallback}
                onTooltipMessage={handleGetStatusMessage}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

FleetStatusComponent.propTypes = {
  isLoading: PropTypes.bool,
  robotId: PropTypes.string,
  sortBy: PropTypes.string,
  attributeStatus: PropTypes.object,
  robotStatus: PropTypes.string,
  robots: PropTypes.array,
  statusList: PropTypes.array,
  statusValues: PropTypes.object,
  onRobotSelected: PropTypes.func,
  getRobotDetailedStatus: PropTypes.func,
};

export default FleetStatusComponent;
