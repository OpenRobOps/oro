/**
 * Renders a toggle button with a small square before the label.
 * The square changes its color (by fading it) if the toggle is off.
 */
import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme, { selected, color }) => ({
  buttonSquare: {
    backgroundColor: selected ? color : alpha(theme.palette.text.buttonText, 0.25),
    border: '2px solid ' + (selected ? color : alpha(theme.palette.text.buttonText, 0.4)),
    borderRadius: '2px',
    display: 'inline',
    width: '10px',
    height: '10px',
    margin: '0 4px',
  },
  buttonIcon: {
    color: selected ? color : alpha(theme.palette.text.buttonText, 0.5),
    display: 'inline',
    width: '14px',
    height: '15px',
    margin: '0 4px',
  },
  buttonLabel: {
    minWidth: 'fit-content',
    textTransform: 'capitalize',
    fontWeight: 'normal',
    fontSize: '14px',
    '&:first-of-type': {
      paddingLeft: '0px'
    },
    color: theme.palette.text.buttonText,
  },
  darkChip: {
    fontSize: '13px',
    color: theme.palette.text.primary,
    padding: 0
  }
}));

const SquareToggleButton = ({
  label,
  onClick,
  IconClass,
  selected,
  color,
  darkChip
}) => {
  const { classes } = useStyles({ selected, color });
  return (
    <Button
      onClick={onClick}
      size="small"
      className={classnames(classes.buttonLabel, { [classes.darkChip]: darkChip })}
    >
      {IconClass ? (
        <IconClass className={classes.buttonIcon} />
      ) : (
        <div className={classes.buttonSquare} />
      )}
      <Typography className={classnames(classes.buttonLabel, { [classes.darkChip]: darkChip })}>
        {label}
      </Typography>
    </Button>
  );
};

SquareToggleButton.propTypes = {
  label: PropTypes.string,
  selected: PropTypes.bool,
  darkChip: PropTypes.bool,
  color: PropTypes.string,
  onClick: PropTypes.func,
  IconClass: PropTypes.object
};

export default SquareToggleButton;
