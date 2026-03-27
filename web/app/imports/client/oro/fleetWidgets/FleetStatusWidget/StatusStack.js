/**
 * Status Stack
 * Renders a vertical set of StatusChips for a given robot.
 * When clicked, it selects the displayed robot through a callback.
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import classNames from 'classnames';
// Oro modules
import { getStatusColor } from '../../../../lib/status';
import StatusChip from './StatusChip';

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'column',
  },
  body: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    overflowX: 'hidden',
    textOverflow: 'ellipsis',
    width: theme.spacing(10),
    cursor: 'pointer',
    height: '100%',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75 / 2),
    border: '1px solid transparent',
    boxSizing: 'border-box',
  },
  bodySelected: {
    backgroundColor: '#3E3155',
    border: '1px solid #3E3155',
  },
  robotName: {
    width: '100%',
    fontSize: '12px',
    lineHeight: '1.15rem',
    overflow: 'hidden',
    textAlign: 'center',
    textOverflow: 'ellipsis',
    fontWeight: theme.fontWeight.medium,
    wordBreak: 'break-all',
    whiteSpace: 'pre-wrap',
  },
  robotNameSelected: {
    color: '#fff',
  },
  statusChipContainer: {
    height: '100%',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    flexDirection: 'column',
    width: '100%',
  },
}));

const StatusStack = ({
  selected, statuses, robot,
  onTooltipMessage, statusList,
  robotSelectCallback
}) => {
  const { classes, theme } = useStyles();

  const handleRobotSelected = useCallback(() => {
    robotSelectCallback(robot);
  }, [robot, robotSelectCallback]);

  const { agentOnline = false } = (robot && robot.status) || {};

  return (
    <div
      data-test="status-stack-robot-container"
      className={classes.container}
      id={'robot-status-stack-' + robot._id}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={classNames(classes.body, { [classes.bodySelected]: selected })}
        data-test="status-stack-robot-body"
        onClick={handleRobotSelected}
      >
        <div className={classes.statusChipContainer}>
          {statusList.map((key) => {
            const status = statuses && statuses[key];
            const statusColor = getStatusColor(status, agentOnline, theme);
            const canRetrieveMessage = status && status.value;
            return (
              <StatusChip
                key={key}
                onTooltipMessage={canRetrieveMessage ? onTooltipMessage : null}
                statusColor={statusColor}
                robotId={robot._id}
                attributeId={key}
              />
            );
          })}
        </div>
        <Typography
          className={classNames(classes.robotName, { [classes.robotNameSelected]: selected })}
          data-test="status-stack-robot-name"
        >
          {robot.name}
        </Typography>
      </div>
    </div>
  );
};

StatusStack.propTypes = {
  robot: PropTypes.object,
  robotSelectCallback: PropTypes.func,
  selected: PropTypes.bool,
  statuses: PropTypes.object,
  statusList: PropTypes.array,
  onTooltipMessage: PropTypes.func,
};

export default StatusStack;
