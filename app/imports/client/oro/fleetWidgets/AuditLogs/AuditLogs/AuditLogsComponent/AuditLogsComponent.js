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
* Audit Logs
* Component that renders a list of event log lines customized to each event module/type
*/
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  TableHead
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import { StyledTableBody, StyledTableCell, StyledTableContainer, StyledTableRow } from '../../../../util/DefaultTable';
import NoDataIcon from '../../../../graphics/op/NoDataIcon';

// header constants
const DATE = 'Date/Time';
const MESSAGE = 'Message';

const useStyles = makeStyles()(() => ({
  // A cell without content doesn't take the fix width given, we are simulating
  // the width of the expandable icon that's in an expandable row in the third column
  // then all the cells should be aligned
  emptyCellWidth: {
    width: '30px'
  }
}));

// no-op for onLogHover when no other callback is passed. Always use the *same* function object!
const DUMMY_ONHOVER_FUNCTION = () => null;

const AuditLogs = ({
  isLoading,
  error,
  auditLogs,
  focusedIndex = null,
  onLogHover = DUMMY_ONHOVER_FUNCTION,
  AuditLogEventRow
}) => {
  const [expanded, setExpanded] = useState({});
  const { classes } = useStyles();
  // click handler to expand event rows
  const handleClick = (event) => {
    // for efficiency, we use only 1 click handler; but then need to bubble
    // up and detect the actual row that was clicked
    let { target } = event;
    if (target.closest) {
      // find closest parent element with the data-index attribute
      // https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
      target = target.closest('[data-index]');
    } else {
      // support for IE, if we ever want it: find it manually
      while (target && !target.hasAttribute('data-index')) {
        target = target.parentNode;
      }
    }
    if (target) {
      const index = target.getAttribute('data-index');
      setExpanded({ [index]: !expanded[index] });
    }
  };

  const tableHeader = (
    <TableHead>
      <StyledTableRow>
        <StyledTableCell width="30%">
          {DATE}
        </StyledTableCell>
        <StyledTableCell width="60%">
          {MESSAGE}
        </StyledTableCell>
        <StyledTableCell width="10%">
          <div className={classes.emptyCellWidth}>
            {' '}
          </div>
        </StyledTableCell>
      </StyledTableRow>
    </TableHead>
  );

  // TODO make a pretty Error state
  if (error) {
    return (
      <StyledTableContainer
        onClick={handleClick}
      >
        <Table
          stickyHeader
          elementtype="table"
          aria-label="sticky table"
          size="small"
        >
          {tableHeader}
          <StyledTableBody>
            <StyledTableRow>
              <StyledTableCell colSpan="3">
                <NoDataIcon />
              </StyledTableCell>
            </StyledTableRow>
          </StyledTableBody>
        </Table>
      </StyledTableContainer>
    );
  }
  // Show loading state only when actually loading
  if (isLoading) {
    return (
      <StyledTableContainer
        onClick={handleClick}
      >
        <Table
          stickyHeader
          elementtype="table"
          aria-label="sticky table"
          size="small"
        >
          {tableHeader}
          <StyledTableBody>
            <StyledTableRow>
              <StyledTableCell colSpan="3">
                Loading...
              </StyledTableCell>
            </StyledTableRow>
          </StyledTableBody>
        </Table>
      </StyledTableContainer>
    );
  }

  // Show no data state when not loading and no logs
  if (!auditLogs?.length) {
    return (
      <StyledTableContainer>
        <Table
          stickyHeader
          elementtype="table"
          aria-label="sticky table"
          size="small"
        >
          {tableHeader}
          <StyledTableBody>
            <div className={classes.noDataIconContainer}>
              <NoDataIcon />
            </div>
          </StyledTableBody>
        </Table>
      </StyledTableContainer>
    );
  }

  // Show logs when we have data
  return (
    <StyledTableContainer
      onClick={handleClick}
    >
      <Table
        stickyHeader
        elementtype="table"
        aria-label="sticky table"
        size="small"
      >
        {tableHeader}
        <StyledTableBody>
          {auditLogs.map((event, index) => (
            <AuditLogEventRow
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              eventObject={event}
              onLogHover={onLogHover}
              isFocused={focusedIndex == index}
            />
          ))}
        </StyledTableBody>
      </Table>
    </StyledTableContainer>
  );
};

AuditLogs.propTypes = {
  error: PropTypes.object,
  isLoading: PropTypes.bool,
  auditLogs: PropTypes.shape({
    logs: PropTypes.array,
    limitMessage: PropTypes.string
  }),
  onLogHover: PropTypes.func,
  focusedIndex: PropTypes.number,
  // Component class that renders the event rows of the table. The component normally depends on
  // Meteor to retrieve rows details, so it is received as a prop here (different versions are
  // instantiated from Dashboards app and UI-Gallery)
  AuditLogEventRow: PropTypes.any
};

export default AuditLogs;
