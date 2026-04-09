/**
 * Implements a visualization of all zones grouped by type.
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ZoneTypeListRowComponent from './ZoneTypeRow/ZoneTypeRowComponent';
import ZoneRowComponent from './ZoneRow/ZoneRowComponent';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';

const useStyles = makeStyles()((theme) => ({
  zoneListContainer: {
    padding: '15px',
    overflowY: 'scroll',
    height: 'inherit'
  },
  zoneType: {
    fontSize: '14px',
    fontStyle: 'normal',
    fontWeight: 500,
    lineHeight: 'normal',
    padding: '5px 0 0 8px'
  },
  zoneTypographyContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: '20px'
  },
  numberOfZonesContainer: {
    display: 'flex',
    alignItems: 'center'
  },
  numberOfZones: {
    display: 'flex',
    width: '16px',
    height: '16px',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background.lightGray,
    borderRadius: '12px'
  },
  number: {
    fontSize: '12px',
    color: theme.palette.text.title
  }
}));

// Displayed at the top of zones list
const ZONES_TITLE = 'Zones';

const ZoneListComponent = (props) => {
  const {
    zoneTypes = [],
    zones = [],
    colorsPalette,
    onColorsPaletteChange
  } = props;
  const { classes } = useStyles();
  const { data: interactionData } = useActiveInteraction();
  const { createNewZone } = interactionData || {};
  // state to control when the new zone to add is expanded
  const [newZoneExpanded, setNewZoneExpanded] = useState();
  const onToggleNewZoneExpanded = () => setNewZoneExpanded(!newZoneExpanded);
  return (
    <Grid className={classes.zoneListContainer}>
      <Grid className={classes.zoneTypographyContainer}>
        <Typography className={classes.zoneType}>
          {ZONES_TITLE}
        </Typography>
        <Grid className={classes.numberOfZones}>
          <Typography
            className={classes.number}
          >
            {zones.length}
          </Typography>
        </Grid>
      </Grid>
      {zoneTypes?.map(zoneType => (
        <ZoneTypeListRowComponent
          key={zoneType._id}
          zoneType={zoneType}
          zones={zones}
          colorsPalette={colorsPalette}
          onColorsPaletteChange={onColorsPaletteChange}
          zoneTypes={zoneTypes}
        />
      ))}
      {createNewZone && (
        <ZoneRowComponent
          onToggleExpanded={onToggleNewZoneExpanded}
          zoneTypes={zoneTypes}
          isExpanded={newZoneExpanded}
          colorsPalette={colorsPalette}
          onColorsPaletteChange={onColorsPaletteChange}
        />
      )}
    </Grid>
  );
};

ZoneListComponent.propTypes = {
  // An array of objects, where each object represents a zone with properties: _id, label, and type
  zones: PropTypes.array,
  // An array of objects, where each object represents a zone type with properties:
  // _id, label, and color
  zoneTypes: PropTypes.array,
  // Props used in NewZoneTypeComponent child of ZoneRowComponent
  colorsPalette: PropTypes.array,
  onColorsPaletteChange: PropTypes.func,
};

export default ZoneListComponent;
