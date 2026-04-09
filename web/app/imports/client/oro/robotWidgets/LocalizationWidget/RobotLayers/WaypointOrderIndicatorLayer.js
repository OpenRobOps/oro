/**
 * Helper component to render a circle with a number inside indicating the step
 * order of the waypoint in a mission. It's only rendered in Mission Definition widget
 */
import React, { useMemo } from 'react';
import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';

const useStyles = makeStyles()(theme => ({
  orderIndicatorContainer: {
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: '30px',
    padding: '0px 6px',
    width: 'fit-content',
    backgroundColor: theme.palette.background.white,
    whiteSpace: 'nowrap'
  },
  orderIndicatorTypography: {
    fontSize: '13px',
    color: theme.palette.primary.main,
    fontWeight: 'bold'
  }
}));

const WaypointOrderIndicator = ({ indexList }) => {
  const { classes } = useStyles();
  if (!indexList) {
    return;
  }
  const indexes = useMemo(() => indexList.join(', '), [indexList]);
  return (
    <div className={classes.orderIndicatorContainer}>
      <Typography className={classes.orderIndicatorTypography}>
        {indexes}
      </Typography>
    </div>
  );
};

WaypointOrderIndicator.propTypes = {
  indexList: PropTypes.array
};

export default WaypointOrderIndicator;
