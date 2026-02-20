/**
 * Incident Component Filter Component
 *  - Displays the dropdown autocomplete of the filter
 *
 * Meteor agnostic component
 */
import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'tss-react/mui';
import { TextField, Typography, Autocomplete } from '@mui/material';

const styles = () => ({
  autoComplete: {
    minWidth: '140px',
    display: 'flex',
    alignSelf: 'end'
  },
  label: {
    fontSize: '0.775rem',
    padding: '0px',
    top: '3px'
  },
  input: {
    fontSize: '0.775rem',
  },
  inputRoot: {
    padding: '0px'
  },
  endAdornment: {
    top: 'calc(50% - 12px)'
  }
});

const renderOption = (props, option) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Typography data-test="component-search-menu-option" {...props}>
    {option.label}
  </Typography>
);

const getOptionLabel = option => ((option && option.label) || '');

const IncidentComponentFilter = ({
  setSelectedIncidentComponent,
  selectedIncidentComponent,
  incidentComponentOptions,
  classes,
  isZeroData,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div />
    );
  }
  return (
    <Autocomplete
      autoComplete
      disableClearable
      classes={{
        option: classes.input,
        input: classes.input,
        endAdornment: classes.endAdornment
      }}
      className={classes.autoComplete}
      onChange={setSelectedIncidentComponent}
      value={selectedIncidentComponent}
      inputValue={(selectedIncidentComponent && selectedIncidentComponent.label)}
      defaultValue={selectedIncidentComponent}
      options={incidentComponentOptions}
      renderOption={renderOption}
      getOptionLabel={getOptionLabel}
      data-test="status-autocomplete-filter"
      disabled={isZeroData}
      renderInput={params => (
        <TextField
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...params}
          fullWidth
          className={classes.input}
          label="Filter by components"
          InputProps={{ ...params.InputProps, disableUnderline: true, className: classes.input }}
          InputLabelProps={{ ...params.InputLabelProps, className: classes.label }}
        />
      )}
    />
  );
};

IncidentComponentFilter.propTypes = {
  setSelectedIncidentComponent: PropTypes.func.isRequired,
  selectedIncidentComponent: PropTypes.shape({
    label: PropTypes.string,
    id: PropTypes.string
  }),
  incidentComponentOptions: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string
  })),
  classes: PropTypes.object,
  isZeroData: PropTypes.bool,
  isLoading: PropTypes.bool
};

export default withStyles(IncidentComponentFilter, styles);
