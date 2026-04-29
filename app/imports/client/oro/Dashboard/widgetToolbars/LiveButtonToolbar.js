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
 * Live Button Toolbar
 *
 * - Toolbar that wraps LiveButton
 *
 * IMPORTANT: Use this toolbar ONLY when the widget requires to have only
 *            the LiveButton in the toolbar if you have a more complex toolbar
 *            use another toolbar (either create a new one or use an existing one),
 *            DO NOT ADD NEW TOOLBAR ELEMENTS TO THIS WIDGET,
 *            unless you are certain of what you are doing.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import LiveButton from '../../util/LiveButton';
import { StartTsPropType } from '../../util/timeUtils';

const LiveButtonToolbar = ({ alwaysLive, startTs, timeRangeMs, setStartTime }) => (
  // DO NOT ADD NEW TOOLBAR ELEMENTS TO THIS WIDGET (Read top IMPORTANT comment)
  (<Grid container spacing={1}>
    <LiveButton
      alwaysLive={alwaysLive}
      startTs={startTs}
      timeRangeMs={timeRangeMs}
      setStartTime={setStartTime}
    />
  </Grid>)
);

LiveButtonToolbar.propTypes = {
  alwaysLive: PropTypes.bool,
  startTs: StartTsPropType,
  timeRangeMs: PropTypes.number,
  setStartTime: PropTypes.func
};

export default LiveButtonToolbar;
