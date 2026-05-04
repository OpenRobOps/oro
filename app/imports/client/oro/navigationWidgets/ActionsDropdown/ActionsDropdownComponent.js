/**
 * ActionsDropdownComponent
 *
 * Acts as a wrapper for ActionsMenu, handling the props that are passed to the component
 * Meteor agnostic component
 */
import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import { NAVIGATION_DETAIL_WIDGET } from '../../../../lib/uiPreferences';
import ActionsMenu from '../../robotWidgets/ActionsMenu';

const ActionsDropdownComponent = (props) => {
  const { textClasses, actions, robot } = props;

  // Render the ActionsMenu only if there are embedded actions
  return actions?.length > 0 ? (
    <ActionsMenu
      data-test="navdet-controls-actions"
      actions={actions}
      robot={robot}
      widget={NAVIGATION_DETAIL_WIDGET}
      textClasses={textClasses}
      isExperimental
    />
  ) : (
    <Fragment />
  );
};

ActionsDropdownComponent.propTypes = {
  textClasses: PropTypes.object,
  actions: PropTypes.object,
  robot: PropTypes.object,
};

export default ActionsDropdownComponent;
