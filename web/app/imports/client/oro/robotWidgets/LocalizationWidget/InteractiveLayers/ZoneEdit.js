import React, { useMemo, useContext, useEffect, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { isEqual, pick } from 'lodash';
import VectorSource from 'ol/source/Vector';
import Collection from 'ol/Collection';
import { Draw, Modify, Snap, Translate as TranslateInteraction } from 'ol/interaction.js';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import Point from 'ol/geom/Point.js';
import { unByKey } from 'ol/Observable';
// ORO modules
import ReactVectorLayer from '../RobotLayers/ReactVectorLayer';
import { FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID, MapContext } from '../Map/Map';
import { createFeature, createZoneGeometry, getPolygonVertices, makeTransparentColor } from '../utils/utils';
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';
import { useLocalizationWidget } from '../../../contexts/LocalizationWidgetContext';

// Color to use when there is no ZoneType yet selected (or color not known for any reason)
const DEFAULT_DRAW_COLOR = '#ffcd87';
const ZONE_EDIT_ID = 'zoneEdit';
const ZONE_POLYGON = 'zonePolygon';

// Styling for Circle Points showed on polygon's vertices
const getCircleStyle = (color, filled) => {
  const fillColor = filled ? color : '#fff';
  return new CircleStyle({
    radius: 5,
    fill: new Fill({
      color: fillColor
    }),
    stroke: new Stroke({
      color,
      width: 3
    }),
  });
};

/**
 * Helper function to create the style to draw a polygon and its vertices.
 *
 * NOTE: Currently style applied to both the Draw interaction and the Source used for input to
 * the Modify interaction -- we might want to have them different
 * Context: https://openlayers.org/en/latest/examples/polygon-styles.html
 *
 * @param {object} zoneType The current zone type, if known. Its style (color) is used
 * @param {object} feature The Polygon itself to obtain the coordinates
 * @param {array}  selectedVertexIdx The vertex index if user click a polygon vertex
 */
const buildDrawStyle = (zoneType, feature, selectedVertexIdx) => {
  const color = zoneType?.style?.color || DEFAULT_DRAW_COLOR;
  const transparentColor = makeTransparentColor(color);
  const polygonCoordinates = feature.getGeometry().getCoordinates()[0];

  const styles = [
    /* We are using two different styles for the polygons:
    *  - The first style is for the polygons themselves.
    *  - The rest of styles will be each vertex that will be drawn as circles.
    */
    new Style({
      fill: new Fill({
        color: transparentColor
      }),
      stroke: new Stroke({
        color,
        width: 3
      }),
    })
  ];

  polygonCoordinates.forEach((coordinates, index) => {
    const pointFeature = new Point(coordinates);
    const isFilled = selectedVertexIdx === index;
    styles.push(
      new Style({
        image: getCircleStyle(color, isFilled),
        geometry: pointFeature
      })
    );
  });

  return styles;
};

// Helper function to find a zone from a list, given its "unique id" containing
// { annotation, entity }.
const findZone = (zones, annotationQualifiedId) => {
  const { annotationId, ...entity } = annotationQualifiedId || {};
  return annotationId && zones && zones.find(zone => (
    zone?.annotation?.annotationId == annotationId && isEqual(zone?.entity || {}, entity)
  ));
};

// To ensure the zone layer is on top during editing, we set zIndex to 40.
// RobotLayer can use zIndex values below 40 (see RobotLayer.js, line 155),
// so this guarantees PolygonEditLayer remains above it.
const PolygonEditLayer = ({ zIndex = 40, zones, zoneTypes, frameId }) => {
  const [selectedVertexIndex, setSelectedVertexIndex] = useState(null);
  const { map } = useContext(MapContext);
  const { data: interactionData, setInteractionData } = useActiveInteraction();
  const {
    annotationQualifiedId: editingAnnotationQualifiedId,
    zoneData,
    createNewZone
  } = interactionData || {};

  // The selected annotation id coming from Localization context. When it changes, we need to sync
  const { selectedAnnotationQualifiedId, setSelectedAnnotationQualifiedId } = useLocalizationWidget();

  // Find the original annotation object being edited if we are not in create mode
  const selectedZone = useMemo(() => (
    !createNewZone && findZone(zones, selectedAnnotationQualifiedId)
  ), [zones, selectedAnnotationQualifiedId, createNewZone]);

  // At the end of the zone -modifying or translating- events
  // We should dispatch the new vertices coordinates to the activeInteraction context.
  const updateZoneCoordinates = useCallback((feature) => {
    const vertices = getPolygonVertices(feature);
    setInteractionData(prevData => ({
      ...prevData,
      // modified is going to be true only if the polygon has been modified
      modified: !isEqual(prevData?.zoneData?.zone?.geometry?.polygon || [], vertices),
      zoneData: {
        ...prevData?.zoneData,
        zone: {
          ...prevData?.zoneData?.zone,
          geometry: {
            polygon: vertices
          },
          frameId
        },
      }
    }));
  }, [zoneData]);

  // Check if polygon vertex is present on clicked features and return its index
  const getSelectedVertexIndex = useCallback(e => (
    // Get vertex index from parent polygon coordinates
    map.forEachFeatureAtPixel(
      e.pixel,
      (clickedF) => {
        let vertexIndex;
        // Get its properties
        const clickedFeatureProperties = clickedF.getProperties();

        // Within the properties, "features" is the parent of this feature being clicked
        // Validate if this property is present and if it is an array
        if (Array.isArray(clickedFeatureProperties?.features)) {
          const parentPolygon = clickedFeatureProperties.features[0];

          // Get properties of the parent
          const parentPolygonProperties = parentPolygon.getProperties();

          // Validate if the parent polygon is in fact the Polygon being edited
          if (parentPolygonProperties?.type === ZONE_POLYGON) {
            // Get coordinates for the Point Vertex
            const vertexCoordinates = clickedFeatureProperties.geometry.getCoordinates();
            // Get All vertices from Polygon
            const polygonCoordinates = parentPolygonProperties.geometry.getCoordinates()[0];

            // Find which position of Polygon coordinates is the Vertex being clicked
            vertexIndex = polygonCoordinates.findIndex(polyCoord => (
              isEqual(polyCoord, vertexCoordinates)
            ));

            // First and last positions of the polygon are the same
            // Replace the first index to the last one
            if (vertexIndex === 0) {
              vertexIndex = polygonCoordinates.length - 1;
            }
          }
        }
        return vertexIndex;
      },
      {
        hitTolerance: 50
      }
    )
  ), [map]);

  // Whenever a new zone is (de)selected, we know it because the prop
  // selectedAnnotationQualifiedId is different from the value editingAnnotationQualifiedId (stored
  // in interactionData context). If they differ, reset any modifications including having moved
  // the zone, or having started to add a new one, and display that zone as selected (or
  // stop displaying it)
  useEffect(() => {
    if (!isEqual(editingAnnotationQualifiedId || {}, selectedAnnotationQualifiedId || {})) {
      const state = {
        annotationQualifiedId: { ...selectedAnnotationQualifiedId },
        zoneData: {}
      };
      // select it (internally to edit) only if it's found in the list of zones
      if (selectedZone) {
        state.zoneData = {
          zone: pick(selectedZone.annotation, ['geometry', 'label'])
        };
        state.zoneData.zone.frameId = frameId;
        setInteractionData(state);
      }
    }
  }, [
    JSON.stringify(editingAnnotationQualifiedId), selectedAnnotationQualifiedId,
    selectedZone, zones
  ]);

  const {
    vectorSource,
    draw,
    modify
  } = useMemo(() => {
    const source = new VectorSource();
    const drawInteraction = new Draw({ source, type: 'Polygon' });
    const modifyInteraction = new Modify({
      source,
      style: new Style({
        image: getCircleStyle(DEFAULT_DRAW_COLOR, false)
      }),
      // use visual vertices representation to detect hit (not just distance to vertex)
      hitDetection: true
    });
    // If the map data is incomplete (outside this component), with no frameId, the zone
    // will not be able to be saved - see zoneEditHooks
    if (!frameId) {
      return {
        vectorSource: null,
        draw: null,
        modify: null,
      };
    }
    drawInteraction.on('drawend', (event) => {
      // When a polygon is completed we get this event. Obtain polygon vertices
      // Note that getPolygonVertices returns a 1-element array with [x,y] (one polyline)
      const vertices = getPolygonVertices(event.feature);
      setInteractionData(prevData => ({
        ...prevData,
        zoneData: {
          ...prevData?.zoneData,
          zone: {
            ...prevData?.zoneData?.zone,
            geometry: {
              polygon: vertices
            },
            frameId
          }
        }
      }));
    });
    return {
      vectorSource: source,
      // draw and modify interactions: only one of each will be added to the map at each time
      draw: drawInteraction,
      modify: modifyInteraction,
    };
  }, [frameId]);

  // If polygon selected changes, reset the previously selected vertex
  useEffect(() => {
    setSelectedVertexIndex(null);
  }, [
    selectedAnnotationQualifiedId
  ]);

  useEffect(() => {
    if (!map || !vectorSource) { return undefined; }
    // Initialize undefined values, so it allows to removeInteraction and event listeners on useEffect cleanup
    let translate;
    let onClickMap;
    let onKeyDown;
    // clear any drawn polygon
    vectorSource.clear();
    // If there is data in the context, it means we are currently *modifying* that zone or
    // polygon. Add it to our VectorSource, with a Modify interaction
    if (zoneData?.zone?.geometry?.polygon) {
      // NOTE: We should use a proper Zone object; using just { geometry } for now
      const geometry = createZoneGeometry(zoneData.zone.geometry);
      const uniqueId = '0';
      const zoneFeature = createFeature(geometry, ZONE_EDIT_ID + JSON.stringify(uniqueId), 0);
      // Property to identify this feature as a zone polygon
      zoneFeature.setProperties({ type: ZONE_POLYGON }, true);
      const zoneType = zoneTypes?.[zoneData.zone.type];
      zoneFeature.setStyle(feature => buildDrawStyle(zoneType, feature, selectedVertexIndex));
      vectorSource.addFeature(zoneFeature);

      // Setting up the Translation Interaction with the zoneFeature just created
      translate = new TranslateInteraction({
        features: new Collection([zoneFeature]),
      });

      map.removeInteraction(draw);
      // note: add Modify _after_ translate, or otherwise Translate has priority (catches more
      // events, including when you want to drag a vertex, and end up moving the polygon)
      map.addInteraction(translate);
      map.addInteraction(modify);

      // Event Listener to understand when to deselect the polygon
      onClickMap = map.on('click', (evt) => {
        const { pixel } = evt;

        // Check if a vertex is clicked and get the index
        const selectedVertexIdx = getSelectedVertexIndex(evt);

        // Check if the clicked feature has a annotationId property
        const clickedAnnotationQualifiedId = map.forEachFeatureAtPixel(
          pixel,
          clickFeature => clickFeature.get(FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID)
        );

        // Validation to handle background clicks on the map when zone edit mode is active.
        // This allows the user to deselect the currently selected zone
        // by clicking on an area of the map without any zones
        if (
          (!clickedAnnotationQualifiedId && !createNewZone)
          && (selectedAnnotationQualifiedId !== editingAnnotationQualifiedId)
          && selectedVertexIdx == null
        ) {
          setSelectedAnnotationQualifiedId(null);
          setInteractionData(null);
          setSelectedVertexIndex(null);
        }

        selectedVertexIdx && setSelectedVertexIndex(selectedVertexIdx);
      });

      // Event listener to check if Delete key is pressed
      onKeyDown = (evt) => {
        if (evt.key === 'Delete') {
          if (selectedVertexIndex != null) {
            const polygonGeometry = zoneFeature.getGeometry();
            const polygonVertices = polygonGeometry.getCoordinates()[0];

            // First and last points are the same, so this means
            // We should only allow to delete points if there are at least 4 points
            if (polygonVertices.length > 4) {
              let newCoords;
              if (selectedVertexIndex === polygonVertices.length - 1) {
                // We should remove the first and last position and then
                // we need to add the second element to the end to close the polygon ring
                newCoords = [...polygonVertices.slice(1, -1), polygonVertices[1]];
              } else {
                newCoords = polygonVertices.filter((el, index) => index !== selectedVertexIndex);
              }

              polygonGeometry.setCoordinates([newCoords]);
              // Update store with new polygon coordinates
              updateZoneCoordinates(zoneFeature);
              // Reset selected index
              setSelectedVertexIndex(null);
            }
          }
        }
      };

      document.addEventListener('keydown', onKeyDown);

      translate.on('translateend', () => {
        updateZoneCoordinates(zoneFeature);
      });
      modify.on('modifyend', () => {
        updateZoneCoordinates(zoneFeature);
      });
    } else {
      // If there was no data in the context
      // and createNewZone is enabled, layer acts as in 'drawing' mode, and will set
      // this interactionData when it completes the drawings
      createNewZone && map.addInteraction(draw);
      map.removeInteraction(modify);
    }
    return () => {
      map.removeInteraction(draw);
      map.removeInteraction(modify);
      // Remove interaction and events if they are active
      translate && map.removeInteraction(translate);
      onClickMap && unByKey(onClickMap); // unByKey unbinds onClickMap event
      onKeyDown && document.removeEventListener('keydown', onKeyDown);
    };
  }, [
    map,
    zoneData?.zone?.geometry,
    zoneData?.zone?.type,
    updateZoneCoordinates,
    zoneTypes,
    createNewZone,
    vectorSource,
    editingAnnotationQualifiedId,
    selectedAnnotationQualifiedId,
    selectedVertexIndex
  ]);

  // Add the Snap interaction -- always added, whether it is in Draw or Modify mode
  useEffect(() => {
    if (!map || !vectorSource) { return undefined; }
    const snap = new Snap({ source: vectorSource });
    map.addInteraction(snap);
    return () => {
      map.removeInteraction(snap);
    };
  }, [map, vectorSource]);

  return (
    <ReactVectorLayer
      name="DrawPolygon"
      source={vectorSource}
      opacity={1}
      zIndex={zIndex}
    />
  );
};
PolygonEditLayer.propTypes = {
  frameId: PropTypes.string,
  zones: PropTypes.array,
  zoneTypes: PropTypes.object,
  zIndex: PropTypes.number,
};

export default PolygonEditLayer;
