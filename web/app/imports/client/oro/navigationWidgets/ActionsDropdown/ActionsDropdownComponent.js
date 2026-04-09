/**
 * ActionsDropdownComponent
 *
 * Acts as a wrapper for ActionsMenu, handling the props that are passed to the component.
 * Meteor agnostic component.
 */
import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import { NAVIGATION_DETAIL_WIDGET } from '../../../../lib/uiPreferences';
import ActionsMenu from '../../robotWidgets/ActionsMenu';

const ActionsDropdownComponent = (props) => {
  const { textClasses, embeddedActions, robot, uiPrefs } = props;

  // Render the ActionsMenu only if there are embedded actions
  return embeddedActions && Object.keys(embeddedActions).length > 0 ? (
    <ActionsMenu
      data-test="navdet-controls-actions"
      actionsConfig={embeddedActions}
      robot={robot}
      widget={NAVIGATION_DETAIL_WIDGET}
      uiConfig={uiPrefs}
      textClasses={textClasses}
      isExperimental
    />
  ) : (
    <Fragment />
  );
};

ActionsDropdownComponent.propTypes = {
  textClasses: PropTypes.object,
  embeddedActions: PropTypes.object,
  robot: PropTypes.object,
  uiPrefs: PropTypes.object,
};

export default ActionsDropdownComponent;
