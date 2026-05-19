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
 * NavigationDetailComponent
 *
 * Renders the navigation detail panels in a single fixed layout:
 * - Background: Localization map (fills left ~70%)
 * - Right panels: Camera, Teleop controls, Gauges, Interaction toolbar
 */
import React, { useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import classnames from 'classnames';
// ORO imports
import ResponsiveGridLayout from '../../util/ResponsiveGridLayout';
import ActiveInteractionControl from '../ActiveInteractionControl';
import { INTERACTION_MODES } from '../interactions';
import {
  getRowHeight,
  KEY_BACKGROUND,
  KEY_CAMERA,
  KEY_GAUGES,
  KEY_INTERACTION,
  KEY_TELEOP,
  LAYOUT_BREAKPOINTS,
  LAYOUT_COLUMNS,
  useLayoutContext,
} from '../LayoutManager';
import { useTimeStampHintContext } from '../../contexts/navigationDetail/TimeStampContext';
import TeleopControls from '../TeleopControls';
import TeleopGauges from '../TeleopGauges';
import CameraGrid from '../CameraGrid';
import LocalizationWithMapInteraction from '../../robotWidgets/LocalizationWidget/LocalizationWithMapInteraction';
import { LOCALIZATION_VARIANTS } from '../../robotWidgets/LocalizationWidget/Localization';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';

const useStyles = makeStyles()(theme => ({
  fullscreenDiv: {
    background: theme.palette.background.navMedium + 'e6',
    borderRadius: '10px',
    boxShadow: '0px 0px 10px 3px rgba(0, 0, 0, 0.5)',
  },
  containerDiv: {
    pointerEvents: 'auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerDivFull: {
    pointerEvents: 'auto',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  subContainerDiv: {
    height: 'calc(100% - 10px)',
    width: 'calc(100% - 10px)',
    pointerEvents: 'auto',
  },
  subContainerDivFull: {
    height: '100%',
    width: '70px',
    pointerEvents: 'auto',
  },
  activeBackground: {
    borderRadius: '0 10px 10px 0',
  },
  teleopActiveBorder: {
    outline: `3px solid ${theme.palette.teleop.openTeleop}`,
  },
  waypointNavActiveBorder: {
    outline: `3px solid ${theme.palette.teleopArrows.stepwise}`,
  },
}));

const LocalizationWithTsHint = (props) => {
  const { updatePoseTs } = useTimeStampHintContext();
  return <LocalizationWithMapInteraction {...props} updatePoseTs={updatePoseTs} />;
};

const CameraGridWithTsHint = (props) => {
  const { updateCameraTs } = useTimeStampHintContext();
  return <CameraGrid {...props} updateCameraTsCallback={updateCameraTs} />;
};

const TeleopControlsWithTsHint = (props) => {
  const { getTsHint } = useTimeStampHintContext();
  return <TeleopControls {...props} getTsHint={getTsHint} />;
};

const NavigationDetailComponent = (props) => {
  const { classes } = useStyles();
  const {
    containerSize,
    robotId,
    selectRobotCallback,
    robotOffline,
    mapLabel,
    isZeroData,
    options,
    isFullscreen,
    onFeedback,
  } = props;

  const layout = useLayoutContext();
  const { activeInteraction } = useActiveInteraction();
  const teleopMode = activeInteraction === INTERACTION_MODES.TELEOP_MODE;
  const waypointNavMode = (
    activeInteraction === INTERACTION_MODES.NAVIGATE_MODE
    || activeInteraction === INTERACTION_MODES.RELOCALIZE_MODE
  );

  const { activeInteractionBorder, activeInteractionBackground } = useMemo(() => ({
    activeInteractionBorder: {
      [classes.teleopActiveBorder]: teleopMode,
      [classes.waypointNavActiveBorder]: waypointNavMode,
    },
    activeInteractionBackground: {
      [classes.activeBackground]: (teleopMode || waypointNavMode) && !isFullscreen,
    },
  }), [teleopMode, waypointNavMode, isFullscreen]);

  const rowHeight = useMemo(() => getRowHeight(containerSize), [containerSize]);

  // Force localization to re-render when entering/leaving fullscreen
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [isFullscreen]);

  const isPanelVisibleFn = useCallback(() => true, []);

  return (
    <>
      {/* Background layer: localization map */}
      <div className={classnames(activeInteractionBorder)} style={{ pointerEvents: 'none', borderRadius: '10px' }}>
        <ResponsiveGridLayout
          style={{ pointerEvents: 'auto' }}
          className="layout"
          width={containerSize.width}
          layouts={layout}
          margin={[0, 0]}
          breakpoints={LAYOUT_BREAKPOINTS}
          cols={LAYOUT_COLUMNS}
          rowHeight={rowHeight}
          isBounded
        >
          <div key={KEY_BACKGROUND}>
            <LocalizationWithTsHint
              selectedRobotId={robotId}
              options={options}
              selectRobotCallback={selectRobotCallback}
              robotOffline={robotOffline}
              variant={LOCALIZATION_VARIANTS.NAVIGATION_DETAIL}
              mapLabel={mapLabel}
              isZeroData={isZeroData}
            />
          </div>
        </ResponsiveGridLayout>
      </div>

      {/* Overlay layer: right-side panels */}
      <div style={{ position: 'relative', top: -containerSize.height, pointerEvents: 'none' }}>
        <ResponsiveGridLayout
          className="layout"
          width={containerSize.width}
          rowHeight={rowHeight}
          margin={[0, 0]}
          containerPadding={isFullscreen ? [0, 60] : [0, 0]}
          breakpoints={LAYOUT_BREAKPOINTS}
          layouts={layout}
          cols={LAYOUT_COLUMNS}
          compactType={null}
          isBounded
        >
          <div key={KEY_CAMERA} className={classnames(classes.containerDiv)}>
            <div className={classnames(classes.subContainerDiv, { [classes.fullscreenDiv]: isFullscreen })}>
              <CameraGridWithTsHint robotId={robotId} isMainCamera={false} isZeroData={isZeroData} />
            </div>
          </div>

          <div key={KEY_INTERACTION} className={classnames(classes.containerDivFull, activeInteractionBackground)}>
            <div className={classnames(classes.subContainerDivFull, { [classes.fullscreenDiv]: isFullscreen })}>
              <ActiveInteractionControl
                robotOffline={robotOffline}
                robotId={robotId}
                isZeroData={isZeroData}
                isPanelVisibleFn={isPanelVisibleFn}
              />
            </div>
          </div>

          <div key={KEY_GAUGES} className={classnames(classes.containerDiv)}>
            <div className={classnames(classes.subContainerDiv, { [classes.fullscreenDiv]: isFullscreen })}>
              <TeleopGauges robotId={robotId} offline={robotOffline} isZeroData={isZeroData} />
            </div>
          </div>

          <div key={KEY_TELEOP} className={classnames(classes.containerDiv)}>
            <div className={classnames(classes.subContainerDiv, { [classes.fullscreenDiv]: isFullscreen })}>
              <TeleopControlsWithTsHint robotId={robotId} offline={robotOffline} isZeroData={isZeroData} onFeedback={onFeedback} />
            </div>
          </div>
        </ResponsiveGridLayout>
      </div>
    </>
  );
};

NavigationDetailComponent.propTypes = {
  containerSize: PropTypes.object,
  robotId: PropTypes.string,
  selectRobotCallback: PropTypes.func,
  robotOffline: PropTypes.bool,
  mapLabel: PropTypes.string,
  isZeroData: PropTypes.bool,
  options: PropTypes.object,
  isFullscreen: PropTypes.bool,
  locationId: PropTypes.string,
  onFeedback: PropTypes.func,
};

export default NavigationDetailComponent;
