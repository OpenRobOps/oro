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
 * React component (no Meteor!) to render action buttons, either in groups or in a single
 * row of buttons..
 * This component is used to render the Actions widget, as well as the actions
 * that get displayed in the notifications banner. It is always wrapped by the WithActionsContext
 * HOC, which parses out configuration, provides grouped actions, decides actions availability
 * (conditional actions, actions depending on locks etc) and handles all the complexity of
 * interactions: asking for confirmation, asking for user-provided args, knowing which action is
 * in flight, etc.
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Grid,
  Button,
  CircularProgress,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { isArray } from 'lodash';
import { withStyles } from 'tss-react/mui';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
// ORO modules
import { GROUP_LABEL_NONE } from '../../../../../../shared/uiPreferences';
import WrapWithTooltip from '../../../../util/WrapWithTooltip';
import createTooltipMessage from './messages';
import ActionIcon from '../../../../graphics/op/ActionIcon';
import DismissIcon from '../../../../graphics/op/DismissIcon';

const VARIANTS = {
  WIDGET: 'widget',
  BANNER: 'banner',
  GROUPED: 'grouped',
  DISMISS: 'dismiss'
};

const styles = theme => ({
  root: {
    boxShadow: 'none',
  },
  typography: {
    fontSize: '0.9rem',
  },
  actionButton: {
    paddingRight: '10px',
    paddingBottom: '10px'
  },
  bigButtonLabel: {
    fontSize: '150%',
  },
  bigButtonLabelBanner: {
    fontSize: '0.875rem',
    color: theme.palette.text.title
  },
  bigButtonDismissBanner: {
    fontSize: '0.875rem',
    textTransform: 'capitalize',
    color: theme.palette.text.title
  },
  buttonLabel: {
    textOverflow: 'ellipsis',
    fontSize: '0.875rem',
  },
  actionBannerComponent: {
    display: 'flex',
    justifyContent: 'end',
    alignContent: 'center',
    [theme.breakpoints.down('1240')]: {
      justifyContent: 'space-around'
    },
  }
});

const panelStyles = theme => ({
  root: {
    borderBottom: `1px solid ${theme.palette.background.gray}`,
    marginBottom: -1,
    '&.Mui-expanded': {
      margin: 0
    },
    '&:first-child': {
      borderTop: `1px solid ${theme.palette.background.gray}`
    },
  },
  expanded: {
    backgroundColor: theme.palette.background.lightBackground,
  }
});

const CustomExpansionPanel = withStyles(Accordion, panelStyles, { withTheme: true });
CustomExpansionPanel.muiName = 'Accordion';

const panelSummaryStyles = {
  root: {
    minHeight: 0,
    padding: '0px 10px 0px 10px',
    height: '32px',
    '&.Mui-expanded': {
      minHeight: 0,
    },
  },
  expanded: {
    minHeight: 0,
  },
  content: {
    minHeight: 0,
    margin: 0
  }
};
const CustomExpansionPanelSummary = withStyles(AccordionSummary, panelSummaryStyles);
CustomExpansionPanelSummary.muiName = 'AccordionSummary';

const panelDetailsStyles = {
  root: {
    paddingTop: 10,
    paddingRight: 10,
    paddingLeft: 10,
    paddingBottom: 6,
  },
};
const CustomExpansionPanelDetails = withStyles(AccordionDetails, panelDetailsStyles);
CustomExpansionPanelDetails.muiName = 'AccordionDetails';

const ActionsButtons = ({
  classes, className, variant, hideLocalActions, 
  // objects and parsed actions passed from WithActionsContext
  actionInFlightId, actions,
  // functions pased from from WithActionsContext
  isActionDisabled, executeAction,
  // additional properties to modify layout
  expanded: expandedByDefault, bigButtons
}) => {
  // Compute action groups as a dictionary from group 'id' (lowercased name) to { actions, label }
  // Actions without a group are included under the key 'Other'
  const actionGroups = useMemo(() => {
    if (!isArray(actions)) {
      return [];
    }
    return actions.reduce((acc, action) => {
      const groupName = action.group || GROUP_LABEL_NONE;
      const groupKey = groupName.toLowerCase();
      if (!acc[groupKey]) {
        // Note that the label is the group name of the first action found in this group.
        // If different casing is found in group names, the first one found will be used 
        // (but at least actions remain in the same group)
        acc[groupKey] = { actions: [], label: groupName };
      }
      acc[groupKey].actions.push(action);
      return acc;
    }, {});
  }, [actions]);

  // If there are no action groups, create a fake one for the code below to render properly
  // (see iteration calling renderActionGroup)
  const [expanded, setExpanded] = useState({});

  /**
   * Decides if an action should be excluded from the widget.
   */
  const passesLocalActionFilter = action => !(hideLocalActions && action.client);

  /**
   * Render one specific action button.
   * If this part of a render loop with sibling components,
   * a unique render key must be provided.
   */
  const renderActionButton = (action = {}, key) => {
    const { label = '' } = action;
    const disabledAction = (action.ui && action.ui.isDisabled)
      || (isActionDisabled && (action._id || action.actionId)
        // _id is for Actions from config; and actionId for preparedActions
        ? isActionDisabled(action._id || action.actionId)
        : false);
    const isVariantGrouped = variant === VARIANTS.GROUPED;
    // The grouped variant makes all buttons within the parent grid
    // to have the same size so they have a uniform look.
    let buttonSize = 'large';
    let buttonVariant;
    let style;
    if (isVariantGrouped) {
      style = {
        display: 'flex',
      };
      if (bigButtons) {
        style.width = '100%';
      }
      buttonVariant = action.client ? 'outlined' : 'contained';
      buttonSize = 'small';
    } else {
      buttonSize = 'large';
    }
    // Checks if the action label is 'dismiss' for proper styling or if it's a banner action
    const isBannerVariant = variant === VARIANTS.BANNER;
    const isDismiss = action.label == VARIANTS.DISMISS;
    const isDismissBanner = (isDismiss ? ({
      label: bigButtons, textPrimary: classes.bigButtonDismissBanner
    }) : ({
      label: bigButtons, textPrimary: classes.bigButtonLabelBanner
    }));
    // TODO memoize onClick handler to avoid unnecessary re-renders
    // (using anonymous functions causes a render on each execution since the function is
    // different each time)
    const button = (
      <Button
        style={style}
        key={key}
        size={buttonSize}
        color="primary"
        onClick={() => executeAction({ action })}
        disabled={actionInFlightId || disabledAction}
        variant={buttonVariant}
        startIcon={isDismiss ? (
          <DismissIcon />
        ) : (
          <ActionIcon />
        )}
        classes={isBannerVariant ? isDismissBanner : {
          label: bigButtons && classes.bigButtonLabel
        }}
      >
        <Typography className={classes.buttonLabel}>
          {label.length < 14 ? (label) : (`${label.slice(0, 14)}...`)}
        </Typography>
        {actionInFlightId && actionInFlightId == (action._id || action.actionId)
          && <CircularProgress size={20} className={classes.spinner} />}
      </Button>
    );
    return WrapWithTooltip(createTooltipMessage(action), button, 'bottom');
  };

  const getActionButtonsRow = (actions, style) => (
    <Grid container className={style}>
      {actions && actions.map((action, ix) => passesLocalActionFilter(action) && (
        <Grid
          item
          xs={bigButtons ? 12 : undefined}
          sm={bigButtons ? 12 : undefined}
          md={bigButtons ? 6 : undefined}
          classes={{ root: classes.actionButton }}
          key={action._id || ix}
        >
          {renderActionButton(action, action._id || ix)}
        </Grid>
      ))}
    </Grid>
  );

  /**
   * Gets action buttons for Banners/Notifications/Alerts
   * @param {Array.<Object>} actions - The actions object definitions array
   */
  const getBannerActionButtons = ({ actions = [] }) => (
    <Grid container className={classes.actionBannerComponent} xs={12}>
      {actions && actions.map((action, ix) => passesLocalActionFilter(action) && (
        <Grid item key={action._id || ix}>
          {renderActionButton(action, action._id || ix)}
        </Grid>
      ))}
    </Grid>
  );

  const handleExpand = (panelId, isExpanded) => {
    setExpanded({ ...expanded, [panelId]: isExpanded });
  };

  const renderActionButtonsGroup = (groupName, groupActions, ignoreHeaders, index) => {
    if (!groupActions?.length) {
      return null; // never render an empty group in the widget
    }
    const isBannerVariant = variant === VARIANTS.BANNER;
    const row = isBannerVariant ? getBannerActionButtons({ actions: groupActions })
      : getActionButtonsRow(groupActions, className);
    const panelId = 'expansionPanel' + index;
    return (ignoreHeaders ? (row)
      : (
        <CustomExpansionPanel
          expanded={Boolean(expanded[panelId])
            || (expandedByDefault
              && expanded[panelId] === undefined)}
          square
          onChange={(event, isExpanded) => handleExpand(panelId, isExpanded)}
          elevation={0}
          key={panelId}
        >
          <CustomExpansionPanelSummary
            id={panelId}
            expandIcon={<ExpandMoreIcon />}
          >
            <Grid container className={className}>
              <Grid item xs={9}>
                <Typography classes={{ root: classes.typography }}>
                  {groupName}
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography classes={{ root: classes.typography }}>
                  {groupActions.length}
                </Typography>
              </Grid>
            </Grid>
          </CustomExpansionPanelSummary>
          <CustomExpansionPanelDetails classes={{ root: classes.panelDetailsRoot }}>
            {row}
          </CustomExpansionPanelDetails>
        </CustomExpansionPanel>
      )
    );
  };

  // We avoid doing useless processing by checking the variant
  if (variant == VARIANTS.BANNER) {
    return Array.isArray(actions) && getBannerActionButtons({ actions });
  } else {
    const isVariantWidget = variant === VARIANTS.WIDGET;


    const ignoreHeaders = Object.keys(actionGroups).length <= 1 // or there are no action groups,
      // define group is "Other"
    if (!ignoreHeaders && actionGroups) {
      const groups = Object.values(actionGroups).sort((a, b) => a.label.localeCompare(b.label));
      return groups.map(({ label: groupLabel, actions }, index) => renderActionButtonsGroup(
        groupLabel, actions, ignoreHeaders, index, isVariantWidget
      ));
    } else {
      // No grouping. Render a fake group with all the 'single' actions collected by the HOC
      return renderActionButtonsGroup(GROUP_LABEL_NONE, actions, true, 0, isVariantWidget);
    }
  }
};

ActionsButtons.defaultProps = {
  variant: VARIANTS.GROUPED
};

ActionsButtons.propTypes = {
  // The array of actions to display
  actions: PropTypes.arrayOf(PropTypes.object),
  // Action execution function
  executeAction: PropTypes.func,
  isActionDisabled: PropTypes.func,
  // If an action is currently executing, the HOC passes its id
  actionInFlightId: PropTypes.string,
  // This flags indicates local (non-agent) actions to be hidden
  hideLocalActions: PropTypes.bool,
  // The current variant for rendering the Actions
  variant: PropTypes.oneOf(Object.values(VARIANTS)),
  // If all sections are initially expanded
  expanded: PropTypes.bool,
  // If buttons are larger than the regular widget (tablet demo)
  bigButtons: PropTypes.bool,
};

export default withStyles(ActionsButtons, styles, { withTheme: true });
