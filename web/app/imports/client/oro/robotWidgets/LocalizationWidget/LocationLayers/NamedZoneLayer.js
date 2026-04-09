/**
 * Component used to display named zones
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style, Text } from 'ol/style';
// ORO Modules
import { FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID } from '../Map/Map';
import ReactVectorLayer from '../RobotLayers/ReactVectorLayer';
import { createFeature, createZoneGeometry, makeTransparentColor } from '../utils/utils';
import theme from '../../../../Styles';

// Opacity of the polygon
const OPACITY = 0.3;
// Style of the font used in polygon's label
const FONT_STYLE = 'bold 13px Calibri,sans-serif';

const NamedZoneLayer = ({ annotation, zIndex = 0, showZoneLabels }) => {
  const { annotation: namedZone = {}, entity } = annotation || {};
  const { geometry, annotationId, style = {} } = namedZone;
  const { color = theme.palette.background.titleBar } = style;
  const uniqueId = { ...entity, annotationId };
  // Creates colored layer for named zone
  const namedZoneSource = useMemo(() => {
    // To be able to add a new feature is necessary to add a vectorSource
    // it's a source of features for vector layers
    const source = new VectorSource();
    // Creates zone feature
    const zoneGeometry = createZoneGeometry(geometry);
    const zoneFeature = createFeature(zoneGeometry, 'zone' + JSON.stringify(uniqueId), 0);
    zoneFeature.set(FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID, uniqueId);
    source.addFeature(zoneFeature);
    // Define the base style for the polygon, including text styling options but without setting the text itself
    const polygonStyle = new Style({
      fill: new Fill({
        color: makeTransparentColor(color, OPACITY)
      }),
      stroke: new Stroke({
        color,
        width: 2
      }),
      text: new Text({
        font: FONT_STYLE,
        fill: new Fill({
          color
        }),
        placement: 'center'
      })
    });
    // Set the text for the style from the namedZone's label property
    showZoneLabels && polygonStyle.getText().setText(namedZone.label);
    // Apply the style to the zone feature
    zoneFeature.setStyle(polygonStyle);
    return source;
  }, [annotation, showZoneLabels]);

  return (
    <ReactVectorLayer
      name="namedZone"
      source={namedZoneSource}
      zIndex={zIndex}
    />
  );
};

NamedZoneLayer.propTypes = {
  annotation: PropTypes.object,
  zIndex: PropTypes.number,
  // Boolean to check if it should or shouldn't show the zone label
  showZoneLabels: PropTypes.bool
};

export default NamedZoneLayer;
export {
  FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID
};
