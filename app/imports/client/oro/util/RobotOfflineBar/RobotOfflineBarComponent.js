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
 * RobotOfflineBar displays a sticky bar under the menu tabs.
 * It includes an icon and some text to let the user quickly understand that a robot is offline
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Typography } from '@mui/material';
import { withStyles } from 'tss-react/mui';
import { BotOff } from 'lucide-react';
import { legacyWithStyles } from '../withStyles';

const styles = theme => ({
  container: {
    position: 'sticky',
    top: '0px',
    /* This component needs to have the same zIndex as the tabs in dashboardSelector,
     to avoid being hidden by the shadow of the tab container and
     to not be on top of the menu selector. */
    zIndex: '1000',
    backgroundColor: theme.palette.background.offlineBar,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 16px',
    margin: '6px 45px 6px 30px',
    borderRadius: '10px',
  },
  message: {
    fontWeight: 500,
    fontSize: '12px',
    paddingLeft: '8px',
    color: theme.palette.common.black
  },
  icon: {
    fontSize: '18px'
  }
});

const ROBOT_OFFLINE_TEXT = 'has been offline since';

const RobotOfflineBar = (props) => {
  const { robot, robotOnline, classes, lastUpdate, theme } = props;
  const robotName = robot && robot.name;
  return (
    <>
      {robot && !robotOnline && (
        <div className={classes.container} data-test="robot-offline-bar">
          <BotOff size={18} color={theme.palette.common.black} />
          <Typography className={classes.message}>
            {robotName} {ROBOT_OFFLINE_TEXT} {lastUpdate}
          </Typography>
        </div>
      )}
    </>
  );
};

RobotOfflineBar.propTypes = {
  classes: PropTypes.object.isRequired,
  robot: PropTypes.object,
  robotOnline: PropTypes.bool,
  lastUpdate: PropTypes.string
};

export default legacyWithStyles(RobotOfflineBar, styles, { withTheme: true });
