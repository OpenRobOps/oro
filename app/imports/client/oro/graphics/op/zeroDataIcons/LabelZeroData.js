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
 * Label Zero Data
 * Simulates the text that would be in the widget, this is used
 * ONLY if the user is under zero data experience (doesn't have a
 * robot installed yet)
 */
import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'tss-react/mui';

const styles = theme => ({
  labelZeroData: {
    backgroundColor: theme.palette.zeroData.gray,
    borderRadius: '10px',
    opacity: 0.5,
  },
});

const LabelZeroData = (props) => {
  const { classes, height, width, margin, backgroundColor, borderRadius } = props;
  return (
    <div
      style={{
        height,
        width,
        margin,
        backgroundColor,
        borderRadius
      }}
      className={classes.labelZeroData}
    />
  );
};

LabelZeroData.propTypes = {
  height: PropTypes.string,
  width: PropTypes.string,
  margin: PropTypes.string,
  backgroundColor: PropTypes.string,
  classes: PropTypes.object,
  borderRadius: PropTypes.string
};

export default withStyles(LabelZeroData, styles, { withTheme: true });
