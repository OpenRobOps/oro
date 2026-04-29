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
 * Robot status List
 *
 * Displays a vertical list of the statuses' labels being displayed
 * on fleet status.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { Typography } from '@mui/material';

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: '3px',
  },
  legendContainer: {
    margin: '2.5px 0 0 0',
    width: '100%',
    height: `calc(${theme.spacing(1.5)} + 3px)`,
    fontSize: theme.spacing(1.5),
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textAlign: 'right',
    textOverflow: 'ellipsis',
    textOrientation: 'upright',
    direction: 'ltr',
  },
}));

const StatusList = ({ statusList, statusValues }) => {
  const { classes } = useStyles();
  return (
  <div className={classes.container} data-test="status-stack-labels">
    {statusList && statusList.map((statusId) => {
      const value = statusValues?.[statusId];
      return (
        <Typography key={statusId} className={classes.legendContainer}>
          {(value?.label) || statusId}
        </Typography>
      );
    })}
  </div>
  );
};

StatusList.propTypes = {
  statusList: PropTypes.array,
  statusValues: PropTypes.object,
};

export default StatusList;

