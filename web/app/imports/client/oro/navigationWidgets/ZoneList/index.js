/**
 * Zone List - Meteor dependent component.
 *
 * This component fetches and displays a list of zones for a specific location.
 * It uses several custom hooks to retrieve zones and zone types configuration.
 */
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import ZoneListComponent from './ZoneListComponent';
import { mapByIdToArray } from '../../../../lib/util';
import LoadingBar from '../../util/LoadingBar';
import theme from '../../../Styles';

// TODO: Implement useTrafficZones and useTrafficZoneTypesConfig hooks for oro
// These hooks need to be created in client/oro/util/hooks.js or a dedicated hooks file.
// They should fetch zones and zone types via Meteor subscriptions/MongoDB queries.
// For now, ZoneList renders without data until these hooks are available.

const ZoneList = ({ locationId }) => {
  // TODO: Implement MongoDB data fetch for zones
  // const { zones, isLoading: zonesLoading } = useTrafficZones({ locationId });
  // TODO: Implement MongoDB data fetch for zone types
  // const { data: zoneTypesConfig, isLoading: zoneTypesLoading } = useTrafficZoneTypesConfig();

  const zones = [];
  const zoneTypesConfig = null;
  const isLoading = false;

  const zoneTypes = mapByIdToArray(zoneTypesConfig?.zoneTypes || {});
  // Palette of colors used when a new zone type is created
  const colorsPalette = [
    { color: theme.palette.tags.skyBlue },
    { color: theme.palette.tags.greenBlue },
    { color: theme.palette.tags.poloBlue },
    { color: theme.palette.tags.lightOrange },
    { color: theme.palette.tags.yellow },
    { color: theme.palette.tags.pink },
    { color: theme.palette.tags.lightBeige }
  ];

  const onColorsPaletteChange = () => { };

  // Function for handling changes to zones or zone types
  const onChange = useCallback(() => { }, []);

  return (
    isLoading ? (
      <LoadingBar />
    ) : (
      <ZoneListComponent
        zoneTypes={zoneTypes}
        zones={zones}
        onChange={onChange}
        colorsPalette={colorsPalette}
        onColorsPaletteChange={onColorsPaletteChange}
      />
    )
  );
};

ZoneList.propTypes = {
  locationId: PropTypes.string
};

export default ZoneList;
