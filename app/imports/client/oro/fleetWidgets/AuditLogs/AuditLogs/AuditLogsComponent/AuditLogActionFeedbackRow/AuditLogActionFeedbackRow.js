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
 * AuditLogActionFeedbackRowComponent
 * Meteor agnostic file
 *
 * Component that renders an expandable row with custom script actions
 * feedback information.
 */
import React from 'react';
import { makeStyles } from 'tss-react/mui';
import { Typography } from '@mui/material';
import PropTypes from 'prop-types';
import { isEmpty } from 'lodash';
// ORO modules
import { StyledTableCell, StyledTableRow } from '../../../../../util/DefaultTable';
import LoadingBar from '../../../../../util/LoadingBar';

const ERROR_ACTION_FEEDBACK = 'Error getting action feedback';
const NO_ACTION_FEEDBACK = 'No action feedback';
const EXECUTION_STATUS = 'Execution Status';
const RETURN_CODE = 'Return Code';
const STDOUT = 'Stdout';
const STDERR = 'Stderr';

const useStyles = makeStyles()(theme => ({
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
  withoutPadding: {
    paddingRight: '0px !important'
  },
  // A cell without content doesn't take the fix width given, we are simulating
  // the width of the expandable icon that's in an expandable row in the third column.
  // Then all the cells should be aligned
  emptyCellWidth: {
    width: '30px'
  },
  expandedRow: {
    backgroundColor: `${theme.palette.background.lightBackground} !important`
  }
}));

const AuditLogActionFeedbackRow = (props) => {
  const { isExpanded, actionDetails, actionDetailsLoading, error } = props;
  const { classes } = useStyles();

  const { executionStatus, stderr, stdout, returnCode } = actionDetails || {};

  // When there's no action feedback, renders a message
  const renderNoContentLine = (
    <React.Fragment>
      <StyledTableCell width="30%" />
      <StyledTableCell width="60%">
        {actionDetailsLoading && (
          <LoadingBar height="20px" center />
        )}
        {error && ERROR_ACTION_FEEDBACK}
        {!error && !actionDetailsLoading && NO_ACTION_FEEDBACK}
      </StyledTableCell>
      <StyledTableCell width="10%">
        <div className={classes.emptyCellWidth}>
          {' '}
        </div>
      </StyledTableCell>
    </React.Fragment>
  );

  // Shows execution output
  const renderInfoBlock = (property, information) => (
    <React.Fragment>
      <Typography className={classes.boldLogText}>
        {`${property}: `}
      </Typography>
      <Typography className={classes.normalLogText}>
        {information}
        <br />
      </Typography>
    </React.Fragment>
  );

  return (
    <StyledTableRow
      data-test="auditlog-row-expanded"
      selected={isExpanded}
      className={classes.expandedRow}
    >
      {!error && !isEmpty(actionDetails) ? (
        <React.Fragment>
          <StyledTableCell width="30%" />
          <StyledTableCell width="60%">
            {executionStatus && renderInfoBlock(EXECUTION_STATUS, executionStatus)}
            {returnCode && renderInfoBlock(RETURN_CODE, returnCode)}
            {stdout && renderInfoBlock(STDOUT, stdout)}
            {stderr && renderInfoBlock(STDERR, stderr)}
          </StyledTableCell>
          <StyledTableCell width="10%">
            <div className={classes.emptyCellWidth}>
              {' '}
            </div>
          </StyledTableCell>
        </React.Fragment>
      ) : (
        renderNoContentLine
      )}
    </StyledTableRow>
  );
};

AuditLogActionFeedbackRow.propTypes = {
  isExpanded: PropTypes.bool,
  // Object containing feedback of custom script actions:
  // - executionStatus: updates about execution process, can be:
  //   To be started, Running, Aborted, Finished
  // - stdout: regular output that the script prints to the console
  // - stderr: error message if any
  actionDetails: PropTypes.objectOf(
    PropTypes.shape({
      executionStatus: PropTypes.string,
      stderr: PropTypes.string,
      stdout: PropTypes.string,
    })
  ),
  actionDetailsLoading: PropTypes.bool,
  error: PropTypes.string
};

export default AuditLogActionFeedbackRow;
