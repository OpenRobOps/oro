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
 * RosDiagnosticsFilter Component
 *
 * This component serves as a filter for ROS Diagnostics within a toolbar.
 * It provides a container for the ToolBarFilterComponent, which displays
 * a group of toggle buttons representing status levels.
 */
import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { capitalize } from 'lodash';
import LiveButton from '../../../util/LiveButton';
import ToolBarFilterComponent from '../../../util/ToolBarFilter';
import { DIAG_VALUES_BUTTONS } from '../../../robotWidgets/DiagnosticsWidget/DiagnosticsWidgetComponent/DiagnosticsEntry';
import { LEVEL_ALL, LEVEL_ERROR, LEVEL_STALE, LEVEL_WARNING } from '../../../robotWidgets/DiagnosticsWidget/DiagnosticsWidgetComponent/DiagnosticsWidgetComponent';

const useStyles = makeStyles()(() => ({
  itemContainer: {
    display: 'flex',
    alignItems: 'center',
    maxHeight: '32px'
  },
  withoutLiveData: {
    justifyContent: 'flex-end'
  },
  icon: {
    width: '12px',
    height: '12px',
    borderRadius: '6px',
    marginRight: '5px'
  }
}));

const RosDiagnosticsFilter = (props) => {
  const {
    selectedRosDiagnosticsLevel,
    setRosDiagnosticsLevel,
    alwaysLive
  } = props;
  const { classes, theme, cx } = useStyles();

  // Creates an array with the diagnostic levels and their corresponding icons
  // to be used in the toolbar buttons.
  // Each object in the array contains a `label` representing the level and an `icon`
  // that displays a small colored circle corresponding to the level.
  // The icon color is determined by the theme's palette.
  const diagValueButtons = useMemo(() => (
    [{
      key: LEVEL_ERROR,
      label: capitalize(LEVEL_ERROR),
      icon: <div
        className={classes.icon}
        style={{ backgroundColor: theme.palette.incidents.error }}
      />
    },
    {
      key: LEVEL_WARNING,
      label: capitalize(LEVEL_WARNING),
      icon: <div
        className={classes.icon}
        style={{ backgroundColor: theme.palette.incidents.warning }}
      />
    },
    {
      key: LEVEL_STALE,
      label: capitalize(LEVEL_STALE),
      icon: <div
        className={classes.icon}
        style={{ backgroundColor: theme.palette.incidents.inactive }}
      />
    },
    {
      key: LEVEL_ALL,
      label: capitalize(LEVEL_ALL),
      icon: null // No icon for "ALL"
    }]
  ), []);

  return (
    <Grid
      container
      className={cx(classes.itemContainer, { [classes.withoutLiveData]: !alwaysLive })}
    >
      {alwaysLive && <LiveButton alwaysLive />}
      <ToolBarFilterComponent
        selectedToolBarButton={selectedRosDiagnosticsLevel}
        setSelectedToolBarButton={setRosDiagnosticsLevel}
        buttonGroup={diagValueButtons}
        byDefault={DIAG_VALUES_BUTTONS.find(b => b == LEVEL_ALL)}
      />
    </Grid>
  );
};

RosDiagnosticsFilter.propTypes = {
  selectedRosDiagnosticsLevel: PropTypes.string,
  setRosDiagnosticsLevel: PropTypes.func,
  // Boolean that checks when to display the live button
  alwaysLive: PropTypes.bool
};

export default RosDiagnosticsFilter;
