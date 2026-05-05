/**
 * Audit Logs Component
 * Every change made here should be added to TimeCapsuleAditLogComponent too
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO modules
import AuditLogsComponent from './AuditLogsComponent';
import AuditLogEventRow from './AuditLogEventRow';

const AuditLogsContainer = (props) => {
  return (
    <AuditLogsComponent
      AuditLogEventRow={AuditLogEventRow}
      {...props}
    />
  );
};

AuditLogsContainer.propTypes = {
  auditLogs: PropTypes.array,
  // each auditLog has the following shape:
  //   {
  //     ts: number,
  //     module: string,
  //     eventType: string,
  //     robotId: string,
  //     robotName: string,
  //     userEmail: string,
  //     userName: string,
  //     userId: string,
  //     eventData: Object
  //   },
  isLoading: PropTypes.bool,
  error: PropTypes.object
};

export default AuditLogsContainer;
