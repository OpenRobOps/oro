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
 * Loading bar animation
 *
 * Contains a loading bar animation, this bar is not a percentage of completion bar
 * The animation wants to simulate a "ball" moving through a bar from left to right
 */
import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { useDarkModeContext } from '../contexts/DarkModeContext';

const useStyles = makeStyles()(theme => ({
  // Start the movement from behind the left side (-50%) and end it past the right side (150%)
  '@keyframes moveBar': {
    '0%': { left: '-50%' },
    '100%': { left: '150%' }
  },
  // The loading container will take all the space from the parent container and center the bar
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%'
  },
  loadingBar: {
    height: '10%',
    width: '30%',
    maxHeight: '10px',
    borderRadius: '5px',
    background: theme.palette.background.loadingBarGray,
    position: 'relative',
    overflow: 'hidden',
    '&:after': {
      animationName: '$moveBar',
      animationDuration: '1s',
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
      content: '""',
      transform: 'translate(-50%)',
      height: '100%',
      width: '100%',
      // Background is a gradient that goes from a "transparent gray" to white,
      // then it returns to the same "transparent gray" to make the illusion of a moving white ball
      background: `linear-gradient(to right,
        ${theme.palette.background.loadingBarTransparentGray}, 10%,
        ${theme.palette.background.white}, 80%,
        ${theme.palette.background.loadingBarTransparentGray}
      )`,
      position: 'absolute',
      borderRadius: '5px'
    }
  },
  justifyLeft: {
    justifyContent: 'left'
  },
  darkModeBar: {
    background: theme.palette.background.navMedium
  }
}));

const LoadingBar = (props) => {
  const { justifyLeft, height, width } = props;
  const { classes, cx } = useStyles();
  const { isDarkMode } = useDarkModeContext();

  return (
    <div className={cx(classes.loadingContainer, { [classes.justifyLeft]: justifyLeft })}>
      <div
        style={{ height, width }}
        className={cx(classes.loadingBar, {
          [classes.darkModeBar]: isDarkMode
        })}
      />
    </div>
  );
};

LoadingBar.propTypes = {
  justifyLeft: PropTypes.bool, // sets justifyContent to the left
  height: PropTypes.string, // height the loading will have
  width: PropTypes.string, // width the loading will have
};

export default LoadingBar;
