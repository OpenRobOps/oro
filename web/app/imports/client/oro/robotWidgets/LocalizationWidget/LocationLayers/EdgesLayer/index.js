/**
 * Renders a list of edges annotations on the map
 * @see [spatial Annotations design document](https://docs.google.com/document/d/1uqw8i68mKQTY0Dc2ZAxhOgkTsVJdJBvGIdAKtCGD6Kc/edit?tab=t.0)
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { isEqual } from 'lodash';
// ORO Modules
import EdgeLayer from './EdgeLayer';

const EdgesLayer = ({ edges, namedWaypoints, zIndex = 6, selectedAnnotationQualifiedId }) => {
  const edgesWithCoords = useMemo(() => {
    if (!Array.isArray(edges) || !Array.isArray(namedWaypoints)) {
      return [];
    }
    // complete each edge with the corresponding named waypoints since this is required for
    // rendering
    return edges.map((edge) => {
      const startWaypoint = namedWaypoints.find(
        nw => nw?.annotation?.annotationId == edge?.annotation?.startWaypointId
      );
      const endWaypoint = namedWaypoints.find(
        nw => nw?.annotation?.annotationId == edge?.annotation?.endWaypointId
      );
      if (!startWaypoint || !endWaypoint) {
        return null;
      }
      return {
        ...edge,
        annotation: {
          ...edge.annotation,
          startWaypointCoord: {
            x: startWaypoint?.annotation?.x,
            y: startWaypoint?.annotation?.y,
            theta: startWaypoint?.annotation?.theta,
          },
          endWaypointCoord: {
            x: endWaypoint?.annotation?.x,
            y: endWaypoint?.annotation?.y,
            theta: endWaypoint?.annotation?.theta,
          },
        }
      };
      // Only include edges with known start and end waypoints
    }).filter(edge => edge?.annotation?.startWaypointCoord);
  }, [edges, namedWaypoints]);

  return edgesWithCoords.map((edge) => {
    const uniqueId = {
      ...edge?.entity,
      annotationId: edge?.annotation?.annotationId
    };
    const isSelected = selectedAnnotationQualifiedId
      && isEqual(uniqueId, selectedAnnotationQualifiedId);
    return (
      <EdgeLayer
        edge={edge}
        key={edge?.annotation?.annotationId}
        zIndex={zIndex}
        isSelected={isSelected}
      />
    );
  });
};

EdgesLayer.propTypes = {
  edges: PropTypes.array,
  namedWaypoints: PropTypes.array,
  zIndex: PropTypes.number,
};

export default EdgesLayer;
