/**
 * Actions widget
 * Displays a list of actions that can be executed on robot.
 *
 * TODO(herchu) Do better design. This is first version, no design at all.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'tss-react/mui';

const styles = () => ({
  container: {
    height: '100%',
    overflowY: 'auto',
    // HACK(herchu) Some of the sub-widget is not properly handling width and
    // overflows by a couple of px with an invisible margin; fixing it by
    // hiding the scrollbar we know we don't use (horizontally)
    overflowX: 'hidden',
    padding: '0px 10px'
  }
});

const ActionsWidget = ({
  classes,
  actionIds,
  robotId,
  expanded,
  bigButtons,
  ActionsButtons,
  isZeroData
}) => (
  <div className={classes.container} id="buttonsContainer">
    <ActionsButtons
      robotId={robotId}
      actionIds={actionIds}
      variant="grouped"
      hideLocalActions
      expanded={expanded}
      bigButtons={bigButtons}
      isZeroData={isZeroData}
    />
  </div>
);

ActionsWidget.propTypes = {
  classes: PropTypes.object,
  robotId: PropTypes.string,
  ActionsButtons: PropTypes.object,
  expanded: PropTypes.bool,
  bigButtons: PropTypes.bool,
  actionIds: PropTypes.array,
  isZeroData: PropTypes.bool
};

export default withStyles(ActionsWidget, styles, { withTheme: true });
