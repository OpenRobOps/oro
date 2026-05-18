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
 * Loading
 * Placeholder for a loading component when it is lazily imported
 *  or it is loading.
 * AVOID importing libraries here... Ideally no imports except react used.
 * TODO: make it pretty!
 */
import React from 'react';
// Note: Consider replacing with own implementation to make it lighter
import CircularProgress from '@mui/material/CircularProgress';
import { withStyles } from 'tss-react/mui';

const styles = () => ({
  divContainer: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '5px',
    padding: '5px',
  },
  progressBar: {
    animationDuration: '600ms'
  }
});

const Loading = ({ classes = {} }) => (
  <div className={classes.divContainer}>
    <CircularProgress
      className={classes.progressBar}
      disableShrink
    />
  </div>
);

export default withStyles(Loading, styles);
