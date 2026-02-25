/**
 * Severity Filter Component
 *
 * Provides a filter with the possible severities of an incident: ICM_SEV_ALL ('SEV 0', 'SEV 1', 'SEV 2', 'SEV 3')
 *
 * Meteor agnostic component
 */
import React from 'react';
// ORO modules
import SeverityFilterComponent from './SeverityFilterComponent';
import { ICM_NONE, ICM_SEV_ALL } from '../../../../shared/alerts';

const SeverityFilter = props => {
  const { setSelectedSeverityFilter, selectedSeverityFilter } = props;
  const onSeverityChanged = (event, newSeverities) => {
    if(newSeverities) {
      // If the first severity is ICM_NONE it means the context it removes the first value
      if(newSeverities[0] === ICM_NONE) {
        newSeverities.shift();
      }
      // If all the severities are selected then the context is removed because it doesn't need to apply any filter
      if(newSeverities.length === ICM_SEV_ALL.length) {
        setSelectedSeverityFilter();
      } else {
        // it sets the new severities context unless it is empty, if that is the case the context will have a ICM_NONE as value
        setSelectedSeverityFilter(newSeverities.length != 0 ? newSeverities : [ICM_NONE]);
      }
    }
  };

  return (
    <SeverityFilterComponent
      {...props}
      onSeverityChanged={onSeverityChanged}
      selectedSeverities={selectedSeverityFilter || ICM_SEV_ALL}
    />
  );
};

export default SeverityFilter;
