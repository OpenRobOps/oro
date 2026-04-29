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
 * SortByComponent: Sort by selector using a chip-in-select pattern.
 * Also exports SORT_BY and SORT_BY_LABELS constants used by the widget.
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { Typography, Menu, MenuItem } from '@mui/material';
import { Cancel, KeyboardArrowDown } from '@mui/icons-material';

export const SORT_BY = {
  IMPORTANCE: 'i',
  NAME: 'n'
};

export const SORT_BY_LABELS = [
  { label: 'Sort by Status', _id: SORT_BY.IMPORTANCE },
  { label: 'Sort by Name', _id: SORT_BY.NAME }
];

const SHORT_LABELS = {
  [SORT_BY.IMPORTANCE]: 'Status',
  [SORT_BY.NAME]: 'Name',
};

// Static objects defined at module level to avoid creating new references on every render
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
  },
  valueChipLabel: {
    fontSize: '13px',
    fontWeight: 400,
    fontFamily: '"Inter", sans-serif',
    color: theme.palette.text.buttonText,
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
  },
  valueChipX: {
    fontSize: '16px !important',
    color: theme.palette.text.buttonText,
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': {
      color: theme.palette.text.primary,
    },
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
    '&:hover': {
      background: theme.palette.background.borderLight,
    },
    '&.Mui-selected': {
      background: theme.palette.background.borderLight,
      color: theme.palette.text.primary,
      '&:hover': {
        background: theme.palette.background.borderMedium,
      },
    },
  },
}));

const SortByComponent = ({ sortBy, onSortBySelected }) => {
  const { classes } = useStyles();
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef(null);

  const currentSortBy = sortBy || SORT_BY.IMPORTANCE;
  const selectedShortLabel = SHORT_LABELS[currentSortBy] || 'Status';

  const handleTriggerClick = useCallback(() => {
    setMenuOpen(true);
  }, []);

  const handleTriggerKeyDown = useCallback((e) => {
    if (e.key === 'Enter') setMenuOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Uses data-id to avoid creating a new handler per item in the map
  const handleMenuItemClick = useCallback((e) => {
    onSortBySelected(e.currentTarget.dataset.id);
    setMenuOpen(false);
  }, [onSortBySelected]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onSortBySelected(SORT_BY.IMPORTANCE);
  }, [onSortBySelected]);

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
          <div className={classes.valueChip}>
            <Typography className={classes.valueChipLabel}>{selectedShortLabel}</Typography>
            <Cancel className={classes.valueChipX} onClick={handleClear} />
          </div>
        </div>
        <KeyboardArrowDown className={classes.chevronIcon} />
      </div>
      <Menu
        anchorEl={anchorRef.current}
        open={menuOpen}
        onClose={handleClose}
        slotProps={{
          paper: {
            className: classes.menuPaper,
          },
        }}
        anchorOrigin={MENU_ANCHOR_ORIGIN}
        transformOrigin={MENU_TRANSFORM_ORIGIN}
      >
        {SORT_BY_LABELS.map(item => (
          <MenuItem
            key={item._id}
            data-id={item._id}
            className={classes.menuItem}
            selected={item._id === currentSortBy}
            onClick={handleMenuItemClick}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

SortByComponent.propTypes = {
  sortBy: PropTypes.string,
  onSortBySelected: PropTypes.func.isRequired,
};

export default SortByComponent;
