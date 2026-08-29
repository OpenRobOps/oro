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
 * Menu List component.
 * Renders an anchored menu list of children components. Children components can be any component
 * that can be rendered as a list, usually an array of React 'li' component.
 */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { MenuList, Popover, MenuItem, Divider } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

// TODO jss-to-tss-react codemod: Unable to handle style definition reliably. ArrowFunctionExpression in CSS prop.
const useStyles = makeStyles()((theme, { subMenuHeader }) => ({
  popperWidth: {
    // Popper minWidth same as anchorRef
    border: `1px solid ${theme.palette.background.borderLight}`,
    // No dark-mode elevation overlay: same flat paper as Menu/Autocomplete dropdowns
    backgroundImage: 'none',
    minWidth: ({ anchorRef }) => (anchorRef.current
      && anchorRef.current.clientWidth) || null
  },
  popper: {
    //  Make sure popper appear above everything
    zIndex: 10
  },
  subMenuItem: {
    right: 0
  },
  subMenuHeader: {
    backgroundColor: (subMenuHeader && subMenuHeader.color) || theme.palette.background.white,
    height: theme.spacing(0.25)
  },
}));

const MenuPopper = (props) => {
  const {
    open, children, anchorRef, callback, subMenu = false, subMenuHeader
  } = props; /** @see MenuPopper.propTypes */

  // Pass anchorRef to useStyles as prop to calculate style
  const { classes } = useStyles({ anchorRef, subMenuHeader });
  const subMenuRef = React.useRef(null);
  const [openMenu, setOpenMenu] = useState(false);
  const handleCloseMenu = () => {
    setOpenMenu(false);
    if (callback) {
      callback(false);
    }
  };

  const handleClickSubMenu = () => {
    setOpenMenu(true);
    if (callback) {
      callback(true);
    }
  };

  // When open prop changes and this is not a subMenu, open the menu
  useEffect(() => {
    if (!subMenu) {
      setOpenMenu(open);
    }
  }, [open]);

  return [(subMenu ? (
    <React.Fragment key={subMenuHeader.label}>
      <MenuItem
        key={subMenuHeader.label}
        ref={subMenuRef}
        onClick={handleClickSubMenu}
      >
        {subMenuHeader.label}
      </MenuItem>
      {subMenuHeader.color ? (
        <Divider
          component="li"
          key={`${subMenuHeader.label}-divider`}
          className={classes.subMenuHeader}
        />
      ) : null}
    </React.Fragment>
  ) : null),
  (
    <Popover
      key={`${subMenuHeader && subMenuHeader.label}-popper`}
      className={classes.popper}
      classes={{
        paper: classes.popperWidth
      }}
      open={subMenu ? openMenu : open}
      anchorEl={subMenu ? subMenuRef.current : anchorRef.current}
      container={subMenu ? subMenuRef.current : anchorRef.current}
      anchorOrigin={{
        vertical: subMenu ? 'top' : 'bottom',
        horizontal: subMenu ? 'right' : 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      onClose={handleCloseMenu}
    >
      <MenuList
        autoFocusItem={open}
        id="menu-list-grow"
        disablePadding
        className={classes.subMenuItem}
      >
        {children}
      </MenuList>
    </Popover>
  )];
};

MenuPopper.propTypes = {
  // Boolean to determine whether the menu should be open or closed
  open: PropTypes.bool.isRequired,
  // The list of children components to render as a menu list
  children: PropTypes.node,
  // The anchorRef to attach the menu list to.
  // Should be created with `React.useRef` or `React.createRef`
  anchorRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any })
  ]).isRequired,
  // Boolean to determine whether this menu list (MenuPopper) is going to be rendered as a sub menu
  // of another MenuPopper. If true, will render a MenuItem component with label subMenuHeader.label
  subMenu: PropTypes.bool,
  // The subMenu header object.
  subMenuHeader: PropTypes.shape({
    label: PropTypes.string
  }),
  // Callback function to set the `open` prop received from parent component. Closes or opens the
  // whole tree of menu lists/sub menus components.
  callback: PropTypes.func,
};

export default MenuPopper;
