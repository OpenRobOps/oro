/**
 * This file includes React-based controls that act as wrappers for certain
 * OpenLayers interactions to be used for the Localization widget.
 */
import { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Collection from 'ol/Collection';
import DrawInteraction from 'ol/interaction/Draw';
import TranslateInteraction from 'ol/interaction/Translate';
import RotateFeatureInteraction from 'ol-rotate-feature';
// ORO Modules
import { MapContext } from '../Map/Map';
import { noStyle } from '../Map/Styles';
import { transformFeatures } from '../utils/geometry';

// Constants for (unchanging) default param values
const EMPTY_ARRAY = [];
const NO_UPDATE_FUNCTION = () => {};
const NO_POSE = { x: 0, y: 0, theta: 0 };

/**
 * This component draws a control and allows the user to drag translate and rotate it.
 * It expect a set of features, all represented with respect to the 0, 0 origin.
 * If an initialPose is provided, the features are placed on the specified initial pose.
 * Every time the user interacts with the control, a callback function is called with the new
 * pose value.
 * The initialPose and pose update values are all expressed in Map coordinates.
 *
 * If a subset of the features should be translated but NOT rotated, these features should be
 * provided in a translateFeatures array instead of in the main features array.
 *
 * In order to identify which particular features should be used for rotating - as opposed
 * to dragging - a filter function translateHandleFilter can be specified to select which
 * features are used to initiate translation - the rest will be used for rotation.
 *
 * @param features:          Array of features to be translated + rotated
 * @param translateFeatures: Array of features to be translated but not rotated
 * @param centerFeature:     Feature that represent the center of translation and rotation
 *                           of the interaction. It's expected to be already included in the
 *                           features or translateFeatures list.
 * @param initialPose        Initial pose for the control. The provided features will be initially
 *                           translated and rotated to this pose before starting the interaction.
 * @param onPoseUpdate       Callback that will receive an update each time the features are
 *                           translated or rotated. It will receive a single parameter which is a
 *                           pose object with the form { x, y, theta }
 * @param translateHandleFilter Filter function to choose which of the features can be
 *                           used as drag handles. The rest will be used as rotate handles.
 *                           This filter function takes a single 'feature' parameter.
 */
const TranslateRotateComponent = ({
  features,
  centerFeature,
  translateFeatures = EMPTY_ARRAY,
  onPoseUpdate = NO_UPDATE_FUNCTION,
  onTranslating = NO_UPDATE_FUNCTION,
  initialPose = NO_POSE,
  style,
  translateHandleFilter
}) => {
  const { map } = useContext(MapContext);

  const { x = 0, y = 0, theta = 0 } = initialPose;
  const [translationCoords, setTranslationCoords] = useState([x, y]);
  const [rotationAngle, setRotationAngle] = useState(theta);
  // Every time the rotation or translation changes, dispatch it through the
  // interaction context
  useEffect(() => {
    onPoseUpdate({
      x: translationCoords[0],
      y: translationCoords[1],
      theta: rotationAngle
    });
  }, [translationCoords, rotationAngle]);

  // Create the map and interactions only once or if the map was changed
  useEffect(() => {
    if (!map) return undefined;

    // Move features to the specified initialPose
    transformFeatures(features, initialPose);
    // translateFeatures should only be translated, omit the pose's theta
    transformFeatures(translateFeatures, { x, y });

    // Vector layer and source to draw all the features in the map
    const layer = new VectorLayer({
      source: new VectorSource({ features: [...features, ...translateFeatures] }),
      name: 'relocalizeLayer',
      style
    });

    // Rotate interaction. It should include all features except translate
    const rotate = new RotateFeatureInteraction({
      features: new Collection([...features]),
      style: noStyle,
      anchor: [x, y],
      angle: initialPose.theta
    });

    // Translate interaction, include all features except the rotate handle
    const translate = new TranslateInteraction({
      features: new Collection([...features, ...translateFeatures]),
      filter: translateHandleFilter
    });

    rotate.on('rotateend', (evt) => {
      // Update the current rotation of the control
      setRotationAngle(evt.angle);
    });
    translate.on('translatestart', () => {
      onTranslating(true);
    });

    translate.on('translateend', () => {
      // Update the current translation of the control
      const newPosition = centerFeature.getGeometry().getFirstCoordinate();
      rotate.setAnchor(newPosition);
      setTranslationCoords(newPosition);
      onTranslating(false);
    });

    // Add layer and interactions to the map
    map.addLayer(layer);
    layer.setZIndex(1000);
    // The order of the interactions is important: the last one will be triggered first
    map.getInteractions().extend([rotate, translate]);

    // clean up the component once unmounted
    return () => {
      if (map) {
        map.removeInteraction(translate);
        map.removeInteraction(rotate);
        map.removeLayer(layer);
      }
    };
  }, [map]);

  return null;
};
TranslateRotateComponent.propTypes = {
  features: PropTypes.array,
  centerFeature: PropTypes.object,
  translateFeatures: PropTypes.array,
  // callback receiving the new pose after a translate gesture finishes
  onPoseUpdate: PropTypes.func,
  // optional callback invoked with true/false when starting and ending a translate gesture
  onTranslating: PropTypes.func,
  initialPose: PropTypes.object,
  style: PropTypes.object,
  translateHandleFilter: PropTypes.func
};

/**
 * A simple click control, which waits for the user to click in the map and then
 * calls the provided callback with the click location.
 *
 * TODO: Simplify using onclick handlers instead of a Draw interaction
 */
const ClickComponent = ({
  onClick
}) => {
  const { map } = useContext(MapContext);

  useEffect(() => {
    if (!map) return () => { };

    const draw = new DrawInteraction({ type: 'Point', style: noStyle });

    draw.on('drawend', (evt) => {
      evt.feature.setStyle(noStyle);
      onClick(evt.feature.getGeometry().getFirstCoordinate());
    });

    map.addInteraction(draw);

    // clean up the component once unmounted
    return () => {
      if (map) {
        map.removeInteraction(draw);
      }
    };
  }, [map, onClick]);

  return null;
};
ClickComponent.propTypes = {
  onClick: PropTypes.func,
};

export { TranslateRotateComponent, ClickComponent };
