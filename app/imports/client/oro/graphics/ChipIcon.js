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
 * Chip Icon used in Zones List -
 * Displays a chip with a border and background color.
 * The opacity of the background color and the border are controlled separately.
 */
import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  chipContent: {
    gap: '8px' // Space between elements inside the chip
  },
  chipBorder: {
    height: 'fit-content' // Make the border height fit the content
  },
  activeChip: {
    border: `2px solid ${theme.palette.incidents.selectedBorder} !important` // Style for the active chip
  }
}));

const ChipIcon = (props) => {
  const {
    color,
    height,
    width,
    onClick,
    opacity,
    withOutlineBorder
  } = props;
  const { classes } = useStyles();

  // Callback for handling chip click event
  const handlePickColor = useCallback(() => {
    onClick({ color });
  }, [onClick, color]);

  // Determine the border style for the chip:
  // - If color is not provided, use a dashed black border.
  // - If onClick is not provided, use a solid border with the provided color.
  // - If onClick is provided, don't set a border style here,
  //   as the white border will be handled separately on the inner div.
  //   When the chip is selected, it will show a different border (see activeChip class)
  const chipBorderStyle = useMemo(() => (
    !color ? '1px dashed black' : !onClick ? `1px solid ${color}` : null
  ), [color, onClick]);

  // Style object for the chip content
  const chipContentStyle = useMemo(() => ({
    backgroundColor: color,
    height,
    width,
    opacity: opacity || 0.3,
    border: onClick ? '2px solid white' : null
  }), [onClick, opacity, color]);

  return (
    <div
      style={{
        border: chipBorderStyle,
        opacity: opacity || 0.8
      }}
      className={classnames(classes.chipBorder, {
        [classes.activeChip]: withOutlineBorder // Add activeChip class if chip is selected
      })}
    >
      <div
        style={chipContentStyle}
        className={classes.chipContent}
        onClick={handlePickColor || null}
        id={color}
      />
    </div>
  );
};

ChipIcon.propTypes = {
  color: PropTypes.string,
  height: PropTypes.string,
  width: PropTypes.string,
  opacity: PropTypes.number,
  withOutlineBorder: PropTypes.bool,
  // optional: when not given, the element is only for presentation (not clickable)
  onClick: PropTypes.func
};

export default ChipIcon;
