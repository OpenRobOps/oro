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
 * LocalizationWidgetContext
 * This component encapsulates handling
 * of dynamic state of the Localization component
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { MAP_LAYERS } from './mapLayers';
import { LOCALIZATION_MAP_TYPES } from '../../../../shared/constants';
import usePersistentLocalState from '../../hooks/usePersistentLocalState';

// React context that handles the states for the localization widget
// The INITIAL_ZOOM constant has the default zoom used at the map init
// The INITIAL_STATE constant is the default state of the localization
// component renders once mounted
// The INITIAL_LAYERS_STATE constant is the default state of the layers
// in the list MAP_LAYERS on ./mapLayers.js
const LocalizationWidgetContext = React.createContext();
const INITIAL_LAYERS_STATE = MAP_LAYERS.reduce((acc, item) => {
  acc[item.id] = item.defaultState || false;
  return acc;
}, {});

const INITIAL_AUTOCENTER = true;
const INITIAL_ZOOM_LEVELS = {
  [LOCALIZATION_MAP_TYPES.IMAGE]: 8, // Default zoom level when indoors (image-based map)
  [LOCALIZATION_MAP_TYPES.NAV_SAT]: 19, // Default zoom level when outdoors (GPS-based map)
};

const INITIAL_STATE = {
  // Zoom level to use when the map is reset
  initialZoomLevel: INITIAL_ZOOM_LEVELS[LOCALIZATION_MAP_TYPES.IMAGE],
  zoomLevel: INITIAL_ZOOM_LEVELS[LOCALIZATION_MAP_TYPES.IMAGE],
  isFollowingRobot: INITIAL_AUTOCENTER,
  layersState: INITIAL_LAYERS_STATE,
  selectedAnnotationQualifiedId: null // object with { annotationId, frameId }
};

const LOCALIZATION_STATE_PERSISTED_KEYS = ['layersState'];

/**
 * Provider for LocalizationWidgetContext.
 * It holds a state including zoom level, layers visual state, etc.
 *
 * Part of this state is persisted in local storage, so that the localization map reuses
 * some preferences every time it is reopened (e.g. which layers are toggled on/off).
 * To avoid sharing this persisted context in different widgets (e.g. the small map used as
 * Robot scope widget, and the bigger map in Navigation scope), the scope is used as part of the
 * usePersistentStorage key. This scope is optional; if not given the state will be shared.
 */
function LocalizationWidgetProvider({ sectionScope = 'any', ...props }) {
  const [state, setState] = usePersistentLocalState(
    INITIAL_STATE,
    `LocalizationWidgetState-${sectionScope}`,
    LOCALIZATION_STATE_PERSISTED_KEYS
  );

  // Ensure new layers added to MAP_LAYERS are present in persisted state.
  // usePersistentLocalState does a shallow merge, so a stale layersState from localStorage
  // will overwrite INITIAL_LAYERS_STATE entirely, missing any newly added layer keys.
  const mergedState = React.useMemo(() => {
    if (!state?.layersState) return state;
    const merged = { ...INITIAL_LAYERS_STATE, ...state.layersState };
    // Only create a new object if there are actually missing keys
    if (Object.keys(merged).length === Object.keys(state.layersState).length) {
      return state;
    }
    return { ...state, layersState: merged };
  }, [state]);

  const value = React.useMemo(() => [mergedState, setState], [mergedState]);
  return (
    <LocalizationWidgetContext.Provider value={value} {...props} />
  );
}
LocalizationWidgetProvider.propTypes = {
  sectionScope: PropTypes.string
};

// returns the state of the LocalizationWidgetContext
function useLocalizationWidget() {
  const context = React.useContext(LocalizationWidgetContext);
  if (context === undefined) {
    throw new Error('useLocalizationWidget must be used within a localizationWidgetProvider');
  }
  const [state, setState] = context;
  const {
    zoomLevel,
    initialZoomLevel,
    customCenter,
    isFollowingRobot,
    layersState,
    selectedAnnotationQualifiedId
  } = (state || {});

  const setZoom = useCallback(
    (newValue = initialZoomLevel) => setState(s => ({ ...s, zoomLevel: newValue })),
    [initialZoomLevel]
  );

  const setCustomCenter = useCallback(
    newValue => setState(s => ({ ...s, customCenter: newValue })),
    []
  );

  const setIsFollowingRobot = useCallback(
    (newValue = INITIAL_AUTOCENTER) => setState(s => ({ ...s, isFollowingRobot: newValue })),
    []
  );
  const setInitialZoom = useCallback(
    (mapType = LOCALIZATION_MAP_TYPES.IMAGE) => setState(
      s => ({ ...s, initialZoomLevel: INITIAL_ZOOM_LEVELS[mapType] })
    ),
    []
  );
  const reset = useCallback(
    () => {
      setState(s => ({ ...s, zoomLevel: initialZoomLevel, isFollowingRobot: INITIAL_AUTOCENTER }));
    },
    [initialZoomLevel]
  );
  const increaseZoom = useCallback(
    () => setState(({ zoomLevel: curZoom, ...rest }) => ({ ...rest, zoomLevel: curZoom + 1 })),
    []
  );
  const decreaseZoom = useCallback(
    () => setState(({ zoomLevel: curZoom, ...rest }) => ({ ...rest, zoomLevel: curZoom - 1 })),
    []
  );
  const setLayerState = useCallback(
    (id, newState) => {
      setState(s => ({ ...s, layersState: { ...s.layersState, [id]: newState } }));
    },
    []
  );

  // helper function to return the state of a specific layer
  const getLayerState = useCallback(
    layerId => (layersState && layersState[layerId]) || {},
    [layersState]
  );

  // helper function to return the visibility of a specific layer
  const isLayerVisible = useCallback(
    layerId => getLayerState(layerId).isVisible,
    [getLayerState]
  );

  const setSelectedAnnotationQualifiedId = useCallback(newValue => (
    setState(s => ({ ...s, selectedAnnotationQualifiedId: newValue }))
  ), [selectedAnnotationQualifiedId]);

  return {
    // integer that represents the zoom level for the map
    zoomLevel,
    // isFollowingRobot is the boolean that indicates if the robot must be followed by the map
    isFollowingRobot,
    // sets the zoom level to the specified value
    setZoom,
    setIsFollowingRobot,
    // set the initial zoom level according to the provided map type
    setInitialZoom,
    // reset zoomLevel and isFollowRobot to their initial values
    reset,
    // increases the current zoom level by 1
    increaseZoom,
    // decreases the current zoom level by 1
    decreaseZoom,
    // changes the custom center to the specified value
    setCustomCenter,
    // [x, y] array with the map custom center
    customCenter,
    // object with the state of the layers
    layersState,
    setLayerState,
    // helper functions of a specific layer
    getLayerState,
    isLayerVisible,
    setSelectedAnnotationQualifiedId,
    selectedAnnotationQualifiedId
  };
}

export {
  LocalizationWidgetProvider,
  useLocalizationWidget
};
