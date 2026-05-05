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
 * ZeroDataAuditLogsRobot Widget
 * Zero Data component for Robot logs component
 * In charge of displaying the robot logs table with placeholder data
 * Presentation component - Meteor agnostic
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Table, TableHead } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import LabelZeroData from '../../../graphics/op/zeroDataIcons/LabelZeroData';
// import { cloneRows } from '../../../../../lib/zeroData';
import { StyledTableBody, StyledTableCell, StyledTableRow } from '../../../util/DefaultTable';

const useStyles = makeStyles()(theme => ({
  multilinePadding: {
    paddingTop: '4px'
  },
  tableCellDate: {
    width: '30%'
  },
  tableCellMessage: {
    whiteSpace: 'nowrap',
    width: '70%'
  },
}));

// stateless 0d placeholder for Audit logs widget
// TODO(Barbie): move the zero data placeholder code to the component file.
const ZeroDataAuditLogs = ({ rowNumber = 5 }) => {
  const { classes } = useStyles();
  const ZERO_DATA_ROW = (
    <>
      <StyledTableCell key="zero-data-auditLog-robot-cell-date" className={classes.tableCellDate}>
        <LabelZeroData height="13px" width="47px" />
        <div className={classes.multilinePadding}>
          <LabelZeroData height="13px" width="63px" />
        </div>
      </StyledTableCell>
      <StyledTableCell data-test="zero-data-auditLog-robot-cell-message" className={classes.tableCellMessage}>
          <LabelZeroData height="13px" width="90%" />
      </StyledTableCell>
    </>
  );

  const auditLogsRobotBody = (
    <StyledTableBody key="zero-data-auditLog-robot-body">
      {cloneRows(ZERO_DATA_ROW, rowNumber).map(
        (row, i) => (
          <StyledTableRow key={`zero-data-auditLog-robot-row-${i}`} data-test={`zero-data-auditLog-robot-row-${i}`}>
            {row}
          </StyledTableRow>
        )
      )}
    </StyledTableBody>
  );

  return (
    <Table
      stickyHeader
      elementtype="table"
      aria-label="sticky table"
      size="small"
    >
      <TableHead data-test="zero-data-auditLog-robot-head">
        <StyledTableRow data-test="zero-data-auditLog-robot-header">
          <StyledTableCell data-test="zero-data-auditLog-robot-date-header" className={classes.tableCellDate}>Date/Time</StyledTableCell>
          <StyledTableCell data-test="zero-data-auditLog-robot-message-header" className={classes.tableCellMessage}>Message</StyledTableCell>
        </StyledTableRow>
      </TableHead>
      {auditLogsRobotBody}
    </Table>
  );
};

ZeroDataAuditLogs.propTypes = {
  rowNumber: PropTypes.number
};

export default ZeroDataAuditLogs;
