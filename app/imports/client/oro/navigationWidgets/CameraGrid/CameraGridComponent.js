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
 * Camera Grid Component
 *
 * Meteor agnostic component
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { isEmpty } from 'lodash';
import { ReactGridLayout as RGL } from 'react-grid-layout';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import useSize from '../useSize';
import CameraView from '../../robotWidgets/CameraView';
import { generateCamerasLayout, RESPONSIVE_ROWS, RESPONSIVE_COLUMNS } from './CameraGridLayouts';
import { useFullscreenContext } from '../../contexts/FullscreenContext';
import WithNoDataMessage from '../../util/WithNoDataMessage';

// Margin in pixels that will be set between the cameras for fullscreen
const CAMERAS_MARGIN = 5;
// Minimum Height for Camera Grid container (When loading camera, avoid having narrow height)
const MIN_HEIGHT = 335;
const MIN_HEIGHT_FULL_SCREEN = 590;

// Zero data camera placeholders (inlined from lib/zeroData)
const zeroCameras = [
  { id: 'zero_camera_1' },
  { id: 'zero_camera_2' },
  { id: 'zero_camera_3' }
];

const useStyles = makeStyles()(() => ({
  cameraGridContainer: {
    width: '100%',
    height: '100%',
    borderRadius: '10px',
    overflow: 'hidden'
  }
}));

/**
 * Get the initial minimum Height for Camera Component to avoid narrow height when not fully loaded.
 */
const getInitialHeight = (height, isFullscreen) => {
  const minHeightToCompare = isFullscreen ? MIN_HEIGHT_FULL_SCREEN : MIN_HEIGHT;

  return Math.max(minHeightToCompare, height);
};

const CameraGridComponent = (props) => {
  const {
    cameras = [],
    robotId,
    isMainCamera,
    updateCameraTsCallback,
    isZeroData
  } = props;

  const [cameraLayout, setCameraLayout] = useState({});
  const cameraContainerRef = useRef(null);
  const cameraGridSize = useSize(cameraContainerRef);
  const { isFullscreen } = useFullscreenContext();
  const { classes } = useStyles();

  /**
   * If under zero data, cameras is going to be an empty array.
   * Push fake images to display in navigation dashboard.
   */
  if (isZeroData && isEmpty(cameras)) cameras.push(...zeroCameras);

  /**
   * Calculates height in pixels that each row has.
   * Takes into account the margins between the "inner rows" of ReactGridLayout.
   */
  const calculateRowHeight = useCallback(
    (height) => {
      let marginHeight = 0;
      if (isFullscreen) {
        // On fullscreen there are no outer margins since the padding is 0,
        // so subtract 1
        marginHeight = (RESPONSIVE_ROWS - 1) * CAMERAS_MARGIN;
      } else {
        // On dashboard mode there is a padding, so it needs to have the whole margin
        marginHeight = RESPONSIVE_ROWS * CAMERAS_MARGIN;
      }
      return (height - marginHeight) / RESPONSIVE_ROWS;
    },
    [isFullscreen]
  );

  /**
   * Generates the initial Grid layout for the cameras.
   */
  useEffect(() => {
    setCameraLayout(generateCamerasLayout(cameras));
  }, [cameras]);

  const renderCameras = useMemo(() => cameras.map((cam, ix) => {
    const { id: cameraId, label, shortLabel } = cam;
    const config = { cameraId };
    return (
      <div key={cameraId}>
        <CameraView
          robotId={robotId}
          label={label}
          shortLabel={shortLabel}
          cameraPrefs={cam}
          config={config}
          updateCameraTsCallback={updateCameraTsCallback}
          isMainCamera={isMainCamera}
          isZeroData={isZeroData}
        />
      </div>
    );
  }), [cameras, robotId, isMainCamera, updateCameraTsCallback, isZeroData]);

  const { height = 1, width = 300 } = cameraGridSize || {};
  // Calculate Row Height, if camera is not loaded use minimum height to avoid narrow height
  const rowHeight = calculateRowHeight(getInitialHeight(height, isFullscreen));
  return (
    <div ref={cameraContainerRef} className={classes.cameraGridContainer}>
      {/* Wait on rendering until we have a defined width and height */}
      {cameraGridSize && cameraLayout && (
        <RGL
          layout={cameraLayout}
          isDraggable={false}
          isResizable={false}
          items={cameras.length}
          cols={RESPONSIVE_COLUMNS}
          rowHeight={rowHeight}
          width={width}
          // Inner margins between the cameras
          margin={[CAMERAS_MARGIN, CAMERAS_MARGIN]}
          // Padding of the container with the cameras
          containerPadding={isFullscreen ? [0, 0] : [5, 1]}
        >
          {renderCameras}
        </RGL>
      )}
    </div>
  );
};

CameraGridComponent.propTypes = {
  cameras: PropTypes.array,
  robotId: PropTypes.string,
  isMainCamera: PropTypes.bool,
  updateCameraTsCallback: PropTypes.func,
  isZeroData: PropTypes.bool
};

export default WithNoDataMessage(CameraGridComponent, { ZeroDataComponent: CameraGridComponent });
