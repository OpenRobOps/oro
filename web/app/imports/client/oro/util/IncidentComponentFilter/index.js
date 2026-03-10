/**
 * Incident component filter
 * Provides a dropdown menu that allows the user to select an incident component
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import useIncidentComponents from '../../hooks/useIncidentComponents';
import IncidentComponentFilterComponent from './IncidentComponentFilterComponent';

// Obj used to clear the selection of the filter menu
const noFilterItem = {
  label: 'No Filter'
};

// NOTE This works only for incidents defined for the company entity
const IncidentComponentFilter = ({
  selectedIncidentComponentFilter,
  setSelectedIncidentComponentFilter,
  ...props
}) => {
  const { components: incidentComponents, isLoading } = useIncidentComponents();
  const incidentComponentOptions = useMemo(() => {
    // Build the list of options
    const components = [];
    if (incidentComponents) {
      for (const k in incidentComponents) {
        if (incidentComponents[k]) {
          components.push({ id: k, label: incidentComponents[k].label });
        }
      }
    }
    components.sort((a, b) => (a.label < b.label ? -1 : 1));
    components.unshift(noFilterItem);
    return components;
  }, [incidentComponents]);

  const selectedIncidentComponent = incidentComponentOptions.find(
    v => v.id == selectedIncidentComponentFilter
  );
  const onIncidentComponentChanged = (event, newValue) => {
    if (newValue) {
      setSelectedIncidentComponentFilter(newValue.id);
    }
  };
  return (
    <IncidentComponentFilterComponent
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
      isLoading={isLoading}
      setSelectedIncidentComponent={onIncidentComponentChanged}
      incidentComponentOptions={incidentComponentOptions}
      selectedIncidentComponent={selectedIncidentComponent}
    />
  );
};

IncidentComponentFilter.propTypes = {
  setSelectedIncidentComponentFilter: PropTypes.func.isRequired,
  selectedIncidentComponentFilter: PropTypes.string
};

export default IncidentComponentFilter;
