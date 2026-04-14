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
 * Vitals Zero Data
 *
 * When the user has not installed a robot yet (zero data experience)
 * he can see a simulation of Vitals
 */
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CircularProgress } from '@mui/material';
import { withStyles } from 'tss-react/mui';
import { grey } from '@mui/material/colors';
import LabelZeroData from '../../../graphics/op/zeroDataIcons/LabelZeroData';


const styles = theme => ({
  container: {
    display: 'flex',
    alignItems: 'center'
  },
  value: {
    position: 'absolute',
    display: 'block',
    fontWeight: theme.fontWeight.medium,
    color: theme.palette.text.darkBlue,
    fontSize: '36px'
  },
  valueDisabled: {
    color: theme.palette.incidents.inactive
  },
  gaugeContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: '1em'
  },
  backgroundRing: {
    color: grey[300],
  },
  backgroundRingDisabled: {
    color: theme.palette.background.gray
  },
  foregroundRing: {
    color: theme.palette.incidents.ok,
    position: 'absolute',
    boxShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.3)',
    borderRadius: '50%'
  },
  // Zero Data Experience:
  foregroundRingBlue: {
    color: theme.palette.zeroData.softBlue,
    position: 'absolute',
    borderRadius: '50%'
  },
  foregroundRingGray: {
    color: theme.palette.background.gray,
  },
});

const VitalsZeroData = (props) => {
  const {
    classes,
    counter
  } = props;
  // If counter is 0 or 3 is going to return a gray ring, we're making this
  // to match the design of zero data where two vitals are blue and the other two are gray
  return (
    <div className={classes.container}>
      <div>
        <LabelZeroData height='15px' width='100px' margin='10px 15px' />
        <div className={classes.gaugeContainer}>
          <CircularProgress
            className={classNames(classes.backgroundRing)}
            size={120}
            thickness={6}
            variant="determinate"
            value={100}
          />
          <CircularProgress
            className={
              classNames(
                classes.foregroundRingBlue,
                { [classes.foregroundRingGray]: counter == 0 || counter == 3 }
              )
            }
            size={120}
            thickness={6}
            variant="determinate"
            value={75}
          />
        </div>
      </div>
    </div>
  );
};

VitalsZeroData.propTypes = {
  classes: PropTypes.object,
  counter: PropTypes.number
};

export default withStyles(VitalsZeroData, styles, { withTheme: true });
