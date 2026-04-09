/**
 * Interactive map layer for editing a Waypoint
 *
 * It makes use of interactionData context to mark which waypoint is being edited (in sync
 * with selectedAnnotationId) and its properties (coordinates, label).
 * It draws a waypoint marker that can be moved or rotated, and its label is edited inline
 */
import React, { useMemo, useEffect, useContext, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { isEqual, isEmpty, pick } from 'lodash';
// ORO modules
import { useLocalizationWidget } from '../../../contexts/LocalizationWidgetContext';
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';
import NamedWaypointLayer from '../RobotLayers/NamedWaypointLayer';
import WaypointLabel from '../RobotLayers/WaypointLabel';
import { SPATIAL_ANNOTATION_TYPES } from '../../../../../shared/constants';
import { TranslateRotateComponent } from './ReactInteractions';
import { createPoseFeatures } from './WaypointNav';
import { MapContext, FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID } from '../Map/Map';
import AnchoredOverlayLayer from '../Map/AnchoredOverlay';
import WaypointLabelDialog from './WaypointLabelDialog';
import { WAYPOINT_EDIT_MODE } from '../../../navigationWidgets/interactions';

// Helper function to find a waypoint from a list, given its "unique id" containing
// { annotationId, robotId, frameId }.
const findWaypoint = (namedWaypoints, annotationQualifiedId) => {
  const { annotationId, ...entity } = annotationQualifiedId || {};
  return annotationId && namedWaypoints && namedWaypoints.find(wpt => (
    wpt?.annotation?.annotationId == annotationId && isEqual(wpt?.entity || {}, entity)
  ));
};

const WaypointEdit = ({ namedWaypoints = [], frameId }) => {
  const { map } = useContext(MapContext);
  // The selected annotation id coming from Localization context. When it changes, we need to sync
  const {
    selectedAnnotationQualifiedId, setSelectedAnnotationQualifiedId
  } = useLocalizationWidget();
  // InteractionData contains current interaction state: which waypoint is being edited.
  // It contains:
  // {
  //   annotationQualifiedId: { annotationId, robotId, frameId }
  //   addingNewElement: bool // when waypoint is new (in this case annotationQualifiedId is null)
  //   annotationData: { x, y, theta, label } // the editable part of the waypoint data
  //   modified: <bool> // a 'dirty' flag
  // }
  const { data: interactionData, setInteractionData, activeInteraction } = useActiveInteraction();
  const {
    annotationQualifiedId: editingAnnotationQualifiedId,
    addingNewElement,
    annotationData
  } = interactionData || {};
  const { x, y, theta, label } = annotationData || {};
  // Find the original annotation object being edited
  const selectedWaypoint = useMemo(() => (
    !addingNewElement && findWaypoint(namedWaypoints, selectedAnnotationQualifiedId)
  ), [namedWaypoints, selectedAnnotationQualifiedId, addingNewElement]);
  // If currently dragging the icon, the waypoint label is hidden (performance, and no pose
  // updates are received *while* translating)
  const [translating, setTranslating] = useState(false);

  const [isEditingLabel, setIsEditingLabel] = useState(false);

  // Whenever a new annotation is (de)selected, we know it because the prop
  // selectedAnnotationQualifiedId is different from the value editingAnnotationQualifiedId (stored
  // in interactionData context). If they differ, reset any modifications including having moved
  // the waypoint, or having started to add a new one, and display that waypoint as selected (or
  // stop displaying it)
  useEffect(() => {
    if (!isEqual(editingAnnotationQualifiedId || {}, selectedAnnotationQualifiedId || {})) {
      const state = {
        annotationQualifiedId: { ...selectedAnnotationQualifiedId },
        annotationData: {},
        modified: false,
        addingNewElement: false
      };
      const waypoint = findWaypoint(namedWaypoints, selectedAnnotationQualifiedId);
      // select it (internally to edit) only if it's found in the list of waypoints
      if (waypoint) {
        state.annotationData = pick(waypoint.annotation, ['x', 'y', 'theta', 'label']);
      }
      setInteractionData(state);
    }
  }, [
    JSON.stringify(editingAnnotationQualifiedId), selectedAnnotationQualifiedId,
    selectedWaypoint, addingNewElement, namedWaypoints
  ]);

  // Create a fake waypoint object with the edited coordinates; rendered as a NamedWaypointLayer
  const tempWaypoint = useMemo(() => (
    (addingNewElement || (selectedWaypoint && !isEmpty(editingAnnotationQualifiedId))) && {
      entity: {
        ...editingAnnotationQualifiedId // NOTE: also contains the annotationId for simplicity
      },
      annotation: {
        type: SPATIAL_ANNOTATION_TYPES.WAYPOINT,
        x,
        y,
        theta,
        label
      }
    }
  ), [editingAnnotationQualifiedId, selectedWaypoint, x, y, theta, label, addingNewElement]);

  // Waypoint label change handlers. Modify the new label stored in the activeInteraction state
  // and toggle 'modified' flag
  const handleLabelDialogOpen = useCallback(() => setIsEditingLabel(true), []);
  const handleLabelDialogClose = useCallback(() => setIsEditingLabel(false), []);
  const handleLabelChanged = useCallback((newLabel) => {
    setInteractionData(({ annotationData: currentData, ...rest }) => ({
      ...rest,
      annotationData: {
        ...currentData,
        label: newLabel,
      },
      modified: true
    }));
    setIsEditingLabel(false);
  }, []);

  // Create features as markers for translating and rotating.
  // NOTE: These are the same as the Waypoint Navigation interaction layer; we may want
  // to use a different icon later.
  const { features, translateFeatures, centerFeature } = useMemo(() => (
    // HACK: Scale waypoint polygon to make it as big as robot markers. Keep this size
    // in sync with NamedWaypointLayer
    createPoseFeatures({ posePreferences: { scale: 1.5 } })
  ), [ // re-create when ready to edit a new waypoint
    // HACK: from above: the entity field also contains the annotationId, so it's a unique id
    JSON.stringify(tempWaypoint?.entity), addingNewElement
  ]);

  const updatePose = (pose) => {
    setInteractionData(({ annotationData: currentData, ...rest }) => ({
      ...rest, // annotation id, addingNewElement flag
      annotationData: {
        ...currentData,
        // As the TranslateRotateComponent does one initial call to updatePose, ignore it if
        // coordinates are not changing (to avoid setting `modified` flag)
        x: pose.x,
        y: pose.y,
        theta: pose.theta
      },
      modified: annotationData.modified || x != pose.x || y != pose.y || theta != pose.theta,
    }));
  };

  // Click handler to add new waypoint.
  // NOTE: We cannot use ClickComponent as in Waypoint Navigation layer, since it opaques
  // clicks to waypoints (which we still want to be clickable/selectable). Also, catching ALL
  // clicks as we do below conflicts with the clicks to select waypoints (handled by Map). So
  // this useEffect starts with a conditional to ignore any click on actual waypoints, and only
  // processes clicks on the background (or: on something else)
  useEffect(() => {
    if (!map) return undefined;
    const backgroundClickFn = (evt) => {
      const { pixel } = evt;
      // Handle clicks only when waypoint edit mode is active.
      if (activeInteraction && activeInteraction !== WAYPOINT_EDIT_MODE) {
        return;
      }
      // Check if the clicked feature has a robotId or a annotationId property
      const clickedAnnotationQualifiedId = map.forEachFeatureAtPixel(
        pixel,
        clickFeature => clickFeature.get(FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID)
      );
      if (clickedAnnotationQualifiedId) {
        return; // do nothing, let others handle it
      }
      // If the map data is incomplete (outside this component), with no frameId, the annotation
      // will not be able to be saved - see waypointEditHooks. It should not happen - but if it does,
      // fail early (as seeing a waypoint, moving it and pressing Save is worse than failing now)
      if (!frameId) {
        console.log('Cannot create new waypoints; no frameId provided to WaypointEdit');
        return;
      }
      // When clicking in any place in the map:
      // - If editing a waypoint (ie. it is selected), then unselect it
      // - If no waypoint was selected, start adding one in the point
      if (selectedAnnotationQualifiedId) {
        setInteractionData((state) => {
          if (!state?.modified) {
            setSelectedAnnotationQualifiedId(null);
          }
          return state;
        });
      } else {
        const point = map.getCoordinateFromPixel(pixel);
        setInteractionData((state) => {
          if (state?.modified) {
            // Do not discard current editing state (keep the new waypoint being edited). In order
            // to cancel editing, click the Trash icon
            return state;
          }
          setSelectedAnnotationQualifiedId(null);
          if (state?.addingNewElement) {
            return { addingNewElement: false, modified: false };
          } else {
            return {
              annotationQualifiedId: null,
              annotationData: {
                x: point[0],
                y: point[1],
                theta: 0,
                label: `Waypoint ${namedWaypoints.length + 1}`,
                // frameId is not strictly part of the waypoint 'data' (it's part of the id,
                // identifying sublocation) but this is the only state object kept for a new
                // waypoint, so we add it here temporarily until waypoint is saved
                frameId
              },
              addingNewElement: true,
              modified: true
            };
          }
        });
      }
    };
    map.on('singleclick', backgroundClickFn);
    return () => {
      map.un('singleclick', backgroundClickFn);
    };
  }, [map, selectedAnnotationQualifiedId, activeInteraction, namedWaypoints]);

  return (
    <>
      {/* Popup dialog to edit labels. Note this is a TEMPORARY workaround to edit labels; we
          should be able to implement inline editing (see comments below) */}
      <WaypointLabelDialog
        title="Waypoint name"
        open={isEditingLabel}
        value={label}
        onClose={handleLabelDialogClose}
        onSubmit={handleLabelChanged}
      />
      { /* if tempWaypoint is created, it's editing OR adding. Render the ghost only
           if selectedWaypoint is also non-null */
        tempWaypoint && selectedWaypoint && (
          <NamedWaypointLayer key="ghost" namedWaypoint={selectedWaypoint.annotation} isGhost />
        )
      }
      {tempWaypoint && !translating && (
        <AnchoredOverlayLayer x={x} y={y} sizeY={1}>
          <WaypointLabel
            waypoint={tempWaypoint.annotation}
            isSelected
            isEditing
            onLabelEdit={handleLabelDialogOpen}
          />
        </AnchoredOverlayLayer>
      )}

      { /* if tempWaypoint is created, render it (it's editing/adding a waypoint */
        tempWaypoint && (
          <TranslateRotateComponent
            // NOTE: When clicking a different waypoint to translate, the following component
            // needs to 'reset' (or: create a new different component) to discard the initialPose.
            // It's important that the `key` prop changes at the same time as initialPose, which is
            // read only once by that component.
            key={`translate-waypoint-${JSON.stringify(tempWaypoint.entity)}-${tempWaypoint.id}`}
            features={features}
            translateFeatures={translateFeatures}
            centerFeature={centerFeature}
            onPoseUpdate={updatePose}
            onTranslating={setTranslating}
            initialPose={tempWaypoint.annotation}
            translateHandleFilter={feature => feature.getId() == 'translateFeature'}
          />
        )
      }
    </>
  );
};

WaypointEdit.propTypes = {
  namedWaypoints: PropTypes.array,
  frameId: PropTypes.string, // to identify sublocation
};

export default WaypointEdit;
