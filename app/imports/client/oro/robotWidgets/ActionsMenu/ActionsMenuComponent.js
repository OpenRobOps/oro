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
 * Actions Menu component.
 * Renders a composed Buttons group (1 main button and a dropdown button).
 * When the dropdown button is clicked, a menu list with nested actions groups will open.
 */
import React, { useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Button, ButtonGroup, MenuItem
} from '@mui/material';
import { withStyles } from 'tss-react/mui';
import { Play, ChevronDown } from 'lucide-react';
import { toolbarControl, toolbarControlIcon } from '../../util/toolbarControlStyles';
import classNames from 'classnames';
import useMediaQuery from '@mui/material/useMediaQuery';
// ORO Modules
import MenuPopper from '../../util/MenuPopper';
import WrapWithTooltip from '../../util/WrapWithTooltip';
import { getActionTooltip } from '../../../../shared/actions';
import { useDarkModeContext } from '../../contexts/DarkModeContext';
import ActionIcon from '../../graphics/op/ActionIcon';
import { createActionGroups } from '../ActionsWidget/util';

const styles = theme => ({
  accentOnHover: {
    '&:hover': {
      color: theme.palette.secondary.main,
      // Text buttons hover to a faint primary overlay, invisible on dark
      // themes; use the same hover surface as menus and outlined buttons
      backgroundColor: theme.palette.background.onHoverGray,
    }
  },
  buttonText: {
    whiteSpace: 'nowrap'
  },
  group: {
    ...toolbarControl(theme),
    padding: 0,
    display: 'inline-flex',
    alignItems: 'stretch',
    // The group owns the border; keep the child text buttons flat
    '& .MuiButton-root': {
      minWidth: 0,
      height: '100%',
      fontSize: '14px',
      fontWeight: 400,
      textTransform: 'none',
      color: 'inherit',
      border: 'none !important',
      borderRadius: 0,
    },
  },
  mainButton: {
    padding: '0 4px 0 8px',
  },
  dropdownButton: {
    padding: '0 2px',
    borderLeft: `1px solid ${theme.palette.background.borderLight} !important`,
  },
  playIcon: toolbarControlIcon(theme),
  chevron: { color: theme.palette.secondary.main },
  actionsMenuContainer: {
    padding: '0 5px'
  },
  mobileActionsMenuContainer: {
    width: '100%',
    padding: '0'
  },
  mobileButtonAction: {
    width: '100%',
    padding: '0 !important',
    justifyContent: 'start',
    fontSize: '13px',
    textTransform: 'capitalize'
  },
  actionsMobileLabel: {
    padding: 0
  },
  dropdownMobileButton: {
    padding: '0 !important',
    justifyContent: 'right'
  }
});

const EMPTY_ARRAY = [];
const DUMMY_FUNCTION = () => {};

const ActionsMenu = (props) => {
  const {
    executeAction = DUMMY_FUNCTION,
    actions = EMPTY_ARRAY,
    textClasses,
    classes
  } = props; /** @see ActionsMenu.propTypes */

  const isMobile = useMediaQuery('(max-width:900px)');

  // Determine how to render actions. There are several scenarios:
  // - Multiple groups: The menu displays "actions", with submenus for each group (each with a list of actions)
  // - A single group (or no groups): The menu displays the first action in the button (to execute with a single click)
  //   and the other actions are in a dropdown menu
  let actionGroups = useMemo(() => {
    return Object.entries(createActionGroups(actions)).reduce((acc, [key, group]) => {
      acc.push({
        _id: key,
        ...group
      });
      return acc;
    }, []);
  }, [actions]);
  let firstAction = null; // if there is a single, distinguished action to render first as a button
  let individualActions = []; // if there are no groups, we render a flat list of actions
  if (actionGroups.length == 1) {
    // Only one group, so we render a flat list of actions (no group name)
    [firstAction, ...individualActions] = actions || [];
  } // else: If there is more than one group, we don't render individual actions but groups instead: actionGroups

  // AnchorRef were Popper will attach to when rendering
  const anchorRef = useRef(null);
  // MenuList `open` state
  const [openMenu, setOpenMenu] = useState(false);

  const handleClickAction = ({ action }) => {
    if (action && action._id && executeAction) {
      executeAction({ action });
    }
    setOpenMenu(false);
  };

  const handleToggleMenu = () => {
    setOpenMenu(prevOpenMenu => !prevOpenMenu);
  };

  const renderMenuItem = (action, ix) => {
    return (action && (
      WrapWithTooltip(getActionTooltip(action),
        (
          <MenuItem
            key={action._id || ix}
            onClick={() => handleClickAction({ action })}
            className={classNames({ [classes.actionsMobileLabel]: isMobile })}
          >
            {action.label}
          </MenuItem>
        ), 'right')
    ));
  };

  return (
    <div className={classNames(classes.actionsMenuContainer, { [classes.mobileActionsMenuContainer]: isMobile })}>
      <ButtonGroup
        ref={anchorRef}
        variant="text"
        className={classNames(classes.group, { [classes.mobileActionsMenuContainer]: isMobile })}
      >
        {WrapWithTooltip(getActionTooltip(firstAction), (
          <Button
            size="medium"
            // if the firstAction exists then onClick executes that action
            // if it does not exist then onClick opens the actions menu
            onClick={firstAction?._id
              ? () => handleClickAction({ action: firstAction })
              : (actionGroups.length && handleToggleMenu) || null}
            data-test="actions-menu-button-1"
            classes={textClasses}
            style={{ borderRight: 'initial' }}
            className={classNames(classes.accentOnHover, classes.mainButton, { [classes.mobileButtonAction]: isMobile })}
          >
            <Play className={classes.playIcon} />
            {firstAction?.label ?? 'Actions'}
          </Button>
        ))}
        <Button
          size="small"
          aria-label="Actions Menu"
          aria-haspopup="menu"
          onClick={handleToggleMenu}
          disabled={!individualActions.length && actionGroups.length <= 1}
          data-test="actions-menu-button-2"
          classes={textClasses}
          style={{ borderRight: 'initial' }}
          className={classNames(classes.accentOnHover, classes.dropdownButton, { [classes.dropdownMobileButton]: isMobile })}
        >
          <ChevronDown className={classes.chevron} />
        </Button>
      </ButtonGroup>
      <MenuPopper
        anchorRef={anchorRef}
        open={openMenu}
        callback={setOpenMenu}
        data-test="actions-menu-popper"
      >
        {individualActions.map(renderMenuItem)}
        {actionGroups.length > 1 && actionGroups.map((actionGroup, ix) => (
          actionGroup.actions.length && (
            <MenuPopper
              key={actionGroup._id || ix}
              subMenu
              anchorRef={anchorRef}
              callback={setOpenMenu}
              open={openMenu}
              subMenuHeader={{
                label: actionGroup.label + '...',
                color: actionGroup.color
              }}
            >
              {actionGroup.actions.map(renderMenuItem)}
            </MenuPopper>
          )
        ))}
      </MenuPopper>
    </div>
  );
};

ActionsMenu.propTypes = {
  classes: PropTypes.object,
  // Action execution function
  executeAction: PropTypes.func,
  // Embedded actions, if any
  actions: PropTypes.array,
  // Classes with the style used fot texts in the component
  textClasses: PropTypes.object
};

export default withStyles(ActionsMenu, styles, { withTheme: true });
