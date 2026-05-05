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
 * AuditLogEventRowComponent
 * Meteor agnostic file
 *
 * Displays event logs as table rows
 */

import React, { useCallback, useMemo } from 'react';
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';
import {
  IconButton,
  Tooltip,
  Typography
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
// ORO modules
import {
  EVENT_MODULES,
  formatEvent
} from '../../../../../../../lib/events'
import { formatTime } from '../../../../../../../lib/util';
import { StyledTableCell, StyledTableRow } from '../../../../../util/DefaultTable';
import AuditLogActionFeedbackRow from '../AuditLogActionFeedbackRow';

const useStyles = makeStyles()(theme => ({
  // Adds styles that aren't by default in the table
  logLine: {
    '&:hover': {
      background: theme.palette.primary.lighter,
    },
  },
  logFocused: {
    background: theme.palette.primary.lighter,
  },
  boldLogText: {
    fontWeight: theme.fontWeight.bold,
    fontSize: '13px',
    display: 'inline'
  },
  withoutBorder: {
    border: '0px'
  },
  normalLogText: {
    fontSize: '13px',
    display: 'inline'
  },
  // A cell without content doesn't take the fix width given, we are simulating
  // the width of the expandable icon that's in an expandable row in the third column
  // then all the cells should be aligned
  emptyCellWidth: {
    width: '30px'
  },
  expandedRow: {
    backgroundColor: `${theme.palette.background.lightBackground} !important`
  }
}));

const AuditLogEventRowComponent = ({
  eventObject,
  onLogHover,
  isFocused,
  isExpanded,
  onExpandRowClicked,
  actionFeedback
}) => {
  const { classes, cx } = useStyles();
  const { module, ts } = eventObject;
  const moduleVal = module;
  const timeVal = formatTime(ts).split(' ');
  const timeValHour = timeVal.splice(1);
  const timeValDay = timeVal.splice(0, 1);

  // Get formatted event data
  const formattedEvent = formatEvent(eventObject);
  const {
    subject,
    actionVerb,
    object,
    prepObject,
    withPreposition,
    tooltip
  } = formattedEvent || {};

  const { data: actionDetails, isLoading: actionDetailsLoading, error } = actionFeedback || {};
  const handleMouseEnter = useCallback(() => {
    onLogHover(eventObject);
  }, [eventObject, onLogHover]);

  const actionExecutionId = useMemo(() => (
    moduleVal == EVENT_MODULES.ACTION
    && eventObject.eventData?.executionId
  ), [moduleVal, eventObject]);

  if (!formattedEvent) {
    return null;
  }

  const gridRow = (
    <>
      <StyledTableRow
        data-test="audit-log-line"
        className={cx(
          classes.logLine,
          { [classes.expandedRow]: isExpanded },
          isFocused ? classes.logFocused : null
        )}
        onMouseEnter={handleMouseEnter}
        selected={isExpanded}
      >
        <StyledTableCell
          className={cx({ [classes.withoutBorder]: isExpanded })}
          width="30%"
        >
          {timeValDay}
          <br />
          {timeValHour.join(' ')}
        </StyledTableCell>
        <StyledTableCell className={cx({ [classes.withoutBorder]: isExpanded })} width="60%">
          {subject}
          <Typography className={classes.boldLogText}>
            {actionVerb}
          </Typography>
          {object}
          &nbsp;
          {prepObject && (
            <>
              {withPreposition && (
                'on '
              )}
              {prepObject}
            </>
          )}
        </StyledTableCell>
        <StyledTableCell className={cx({ [classes.withoutBorder]: isExpanded })} width="10%">
          {actionExecutionId||true ? ( // only rows corresponding to executing scripts can be expanded
            <IconButton aria-label="expand row" size="small" onClick={onExpandRowClicked} sx={{ p: 0 }}>
              {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          ) : (
            null
          )}
        </StyledTableCell>
      </StyledTableRow>
      { isExpanded && (
        <AuditLogActionFeedbackRow
          isExpanded={isExpanded}
          actionDetails={actionDetails}
          actionDetailsLoading={actionDetailsLoading}
          error={error}
        />
      )}
    </>
  );
  return (
    tooltip ? (
      <Tooltip title={tooltip} placement="right-start" disableInteractive>
        {gridRow}
      </Tooltip>
    ) : (
      gridRow
    )
  );
};

AuditLogEventRowComponent.propTypes = {
  eventObject: PropTypes.shape({
    robotId: PropTypes.string,
    robotName: PropTypes.string,
    eventType: PropTypes.string,
    module: PropTypes.string,
    // eventData is an object that contains event-specific data
    // and depends on the eventType
    eventData: PropTypes.object,
    ts: PropTypes.number
  }),
  onLogHover: PropTypes.func,
  isFocused: PropTypes.bool,
  actionFeedback: PropTypes.object,
  isExpanded: PropTypes.bool,
  onRowExpandedClicked: PropTypes.func
};

export default AuditLogEventRowComponent;
