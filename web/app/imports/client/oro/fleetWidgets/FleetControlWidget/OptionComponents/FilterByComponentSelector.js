/**
 * FilterByComponentSelector: chip-in-select dropdown for the component/attribute status filter.
 * Shows a placeholder when no filter is active; shows a chip with icon + label when one is set.
 */
import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { Typography, Menu, MenuItem } from '@mui/material';
import { Cancel, KeyboardArrowDown } from '@mui/icons-material';

const MENU_ANCHOR_ORIGIN = { vertical: 'bottom', horizontal: 'left' };
const MENU_TRANSFORM_ORIGIN = { vertical: 'top', horizontal: 'left' };

const useStyles = makeStyles()(theme => ({
  selectTrigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '32px',
    background: theme.palette.background.black,
    border: `1px solid ${theme.palette.background.borderLight}`,
    borderRadius: '4px',
    padding: '0 4px',
    cursor: 'pointer',
    overflow: 'hidden',
    boxSizing: 'border-box',
    width: '100%',
  },
  selectInner: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  placeholder: {
    fontSize: '13px',
    fontFamily: '"Inter", sans-serif',
    color: theme.palette.text.inactive,
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
  },
  valueChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '24px',
    padding: '0 7px',
    borderRadius: '4px',
    background: theme.palette.background.borderLight,
    border: `1px solid ${theme.palette.background.borderLight}`,
    flexShrink: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  chipIcon: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  valueChipLabel: {
    fontSize: '13px',
    fontFamily: '"Inter", sans-serif',
    color: theme.palette.text.buttonText,
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  valueChipX: {
    fontSize: '16px !important',
    color: theme.palette.text.buttonText,
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': { color: theme.palette.text.primary },
  },
  chevronIcon: {
    fontSize: '24px !important',
    color: theme.palette.text.primary,
    flexShrink: 0,
  },
  menuPaper: {
    background: theme.palette.background.surface,
    border: `1px solid ${theme.palette.background.borderLight}`,
    borderRadius: '6px',
    boxShadow: `0 8px 24px ${theme.palette.boxShadow.light}`,
  },
  menuItem: {
    fontSize: '13px',
    fontFamily: '"Inter", sans-serif',
    color: theme.palette.text.buttonText,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    '&:hover': { background: theme.palette.background.borderLight },
    '&.Mui-selected': {
      background: theme.palette.background.borderLight,
      color: theme.palette.text.primary,
      '&:hover': { background: theme.palette.background.borderMedium },
    },
  },
  menuItemIcon: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
}));

const FilterByComponentSelector = ({ options, value, onChange }) => {
  const { classes } = useStyles();
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef(null);

  const hasValue = value?.value != null;

  const handleTriggerClick = useCallback(() => setMenuOpen(true), []);
  const handleTriggerKeyDown = useCallback((e) => {
    if (e.key === 'Enter') setMenuOpen(true);
  }, []);
  const handleClose = useCallback(() => setMenuOpen(false), []);

  // Uses data-idx to avoid creating a new handler per item in the map
  const handleMenuItemClick = useCallback((e) => {
    const idx = Number(e.currentTarget.dataset.idx);
    onChange(options[idx]);
    setMenuOpen(false);
  }, [onChange, options]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange(options[0]); // options[0] is always noFilterItem
  }, [onChange, options]);

  return (
    <>
      <div
        ref={anchorRef}
        className={classes.selectTrigger}
        onClick={handleTriggerClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleTriggerKeyDown}
      >
        <div className={classes.selectInner}>
          {hasValue ? (
            <div className={classes.valueChip}>
              {value.icon && <span className={classes.chipIcon}>{value.icon}</span>}
              <Typography className={classes.valueChipLabel}>{value.label}</Typography>
              <Cancel className={classes.valueChipX} onClick={handleClear} />
            </div>
          ) : (
            <Typography className={classes.placeholder}>Select components</Typography>
          )}
        </div>
        <KeyboardArrowDown className={classes.chevronIcon} />
      </div>
      <Menu
        anchorEl={anchorRef.current}
        open={menuOpen}
        onClose={handleClose}
        slotProps={{ paper: { className: classes.menuPaper } }}
        anchorOrigin={MENU_ANCHOR_ORIGIN}
        transformOrigin={MENU_TRANSFORM_ORIGIN}
      >
        {options.map((option, idx) => (
          <MenuItem
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            data-idx={idx}
            className={classes.menuItem}
            selected={JSON.stringify(option.value) === JSON.stringify(value?.value)}
            onClick={handleMenuItemClick}
          >
            {option.icon && <span className={classes.menuItemIcon}>{option.icon}</span>}
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

FilterByComponentSelector.propTypes = {
  options: PropTypes.array.isRequired,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
};

export default FilterByComponentSelector;
