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
