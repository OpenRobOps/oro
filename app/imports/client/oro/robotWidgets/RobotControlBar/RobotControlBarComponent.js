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
 * Robot Control Bar Component
 *
 * Meteor agnostic component
 */
import React from 'react';
import PropTypes from 'prop-types';
import useMediaQuery from '@mui/material/useMediaQuery';
import { withStyles } from 'tss-react/mui';
// ORO modules

const styles = theme => ({
  componentTitle: {
    fontWeight: theme.fontWeight.medium,
    padding: '0.5rem 0.5rem 0.5rem 0',
  },
  titleButtonsMobile: {
    display: 'flex',
    flexDirection: 'column',
  },
  infoName: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: '40px',
    margin: '0px',
    padding: '0px 3px'
  },
  autoComplete: {
    minWidth: '10rem',
    maxWidth: '15rem'
  }
});

const RobotControlBar = (props) => {
  const {
    isLoading, classes,
    robotId, robotName, offline, robot,
    lockConfig,
    restartAndUpdateActionsConfig, selectRobotCallback,
    navigationDetailCallback,
    RobotInfoButtons, RobotSearch, setSelectedRobotId
  } = props;
  const hidden = useMediaQuery('(max-width: 670px)');

  return (
    <div className={classes.infoName}>
      <RobotSearch
        setSelectedRobotId={setSelectedRobotId}
        className={classes.autoComplete}
        selectedRobotId={robotId}
        selectRobotCallback={selectRobotCallback}
        robotData={robot}
      />
      {!isLoading && robot && !hidden && (
          <RobotInfoButtons
            robotId={robotId}
            name={robotName}
            offline={offline}
            version={robot.version}
            variant={robot.variant}
            updateStamp={robot.updateStamp}
            actionsConfig={restartAndUpdateActionsConfig}
            robot={robot}
            lockConfig={lockConfig}
            onNavigationDetail={navigationDetailCallback}
            lock={robot.lock}
            selectRobotCallback={selectRobotCallback}
          />
      )}
    </div>
  );
};

RobotControlBar.propTypes = {
  classes: PropTypes.object,
  isLoading: PropTypes.bool,
  // selected robot variables
  robotId: PropTypes.string,
  robot: PropTypes.object,
  robotName: PropTypes.string,
  offline: PropTypes.bool,
  selectRobotCallback: PropTypes.func,
  navigationDetailCallback: PropTypes.func,
  lockConfig: PropTypes.object, // configuration for Robot Lock
  restartAndUpdateActionsConfig: PropTypes.object, // Subset of actionsConfig
  RobotInfoButtons: PropTypes.func,
  RobotSearch: PropTypes.func,
};

export default withStyles(RobotControlBar, styles, { withTheme: true });
