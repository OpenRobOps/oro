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
 * Actions widget
 * Displays a list of actions that can be executed on robot.
 *
 */
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
  ActionsButtons: PropTypes.elementType,
  expanded: PropTypes.bool,
  bigButtons: PropTypes.bool,
  actionIds: PropTypes.array,
  isZeroData: PropTypes.bool
};

export default withStyles(ActionsWidget, styles, { withTheme: true });
