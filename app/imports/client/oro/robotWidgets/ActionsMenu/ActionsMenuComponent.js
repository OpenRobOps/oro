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
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
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
  remoteAction: {
    backgroundColor: theme.palette.background.white,
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    // Make the height of the submenu options the same as the menu options
    maxHeight: '32px',
    textTransform: 'uppercase',
    fontWeight: theme.fontWeight.medium,
    color: theme.palette.background.black,
    '&:hover': {
      backgroundColor: theme.palette.background.onHoverGray,
      color: theme.palette.background.black,
    }
  },
  remoteActionDark: {
    backgroundColor: theme.palette.background.black,
    color: theme.palette.background.white,
    '&:hover': {
      color: theme.palette.background.white,
    }
  },
  buttonText: {
    whiteSpace: 'nowrap'
  },
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
  iconProp: {
    color: theme.palette.background.black,
    marginRight: '4px'
  },
  iconPropDark: {
    color: theme.palette.background.white,
    '&:hover': {
      color: theme.palette.background.black,
    }
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
  // Darkmode context
  const isDarkMode = true; // hardcoded for now

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
            className={classNames(
              { [classes.remoteAction]: action && !action.client },
              { [classes.actionsMobileLabel]: isMobile },
              { [classes.remoteActionDark]: isDarkMode }
            )}
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
        className={classNames({ [classes.mobileActionsMenuContainer]: isMobile })}
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
            className={classNames({ [classes.mobileButtonAction]: isMobile })}
          >
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
          className={classNames({ [classes.dropdownMobileButton]: isMobile })}
        >
          <ArrowDropDownIcon />
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
