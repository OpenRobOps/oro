/**
 * Represents a group of zones with the same type.
 * It can be collapsed as a summary with just the zones count,
 * or expanded to view and edit zones.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { isEmpty } from 'lodash';
import classnames from 'classnames';
import { AccordionSummary, Typography, Grid, AccordionDetails, Accordion, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Edit } from '@mui/icons-material';
import ZoneRowComponent from '../ZoneRow/ZoneRowComponent';
import ChipIcon from '../../../graphics/ChipIcon';
import { useLocalizationWidget } from '../../../contexts/LocalizationWidgetContext';
import NewZoneTypeComponent from '../NewZoneType/NewZoneTypeComponent';

const PRESET_ZONE_TYPES = ['nogo', 'soz'];

const useStyles = makeStyles()(theme => ({
  zoneLabel: {
    color: theme.palette.text.content,
    fontSize: '13px',
    fontWeight: theme.fontWeight.lightPlus,
    padding: 0
  },
  accordion: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    boxShadow: 'none',
    paddingLeft: '8px',
    '.MuiAccordionSummary-root': {
      padding: ' 0px',
      minHeight: '30px !important',
      width: '100%'
    },
    '.MuiCollapse-root': {
      width: '-webkit-fill-available'
    },
    '&:before': {
      background: 'transparent',
      height: 0
    }
  },
  accordionSummary: {
    '& .MuiAccordionSummary-content': {
      display: 'flex',
      alignItems: 'center',
      margin: '0 !important',
      justifyContent: 'space-between',
    },
  },
  icon: {
    fontSize: '20px',
  },
  editIcon: {
    fontSize: '16px',
  },
  labelContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  accordionDetails: {
    padding: '0px 0px 6px 0px'
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
  },
  newZoneTypeContainer: {
    padding: '10px 0px'
  },
  iconButton: {
    padding: '0px 5px 0 0'
  }
}));

const ZoneTypeRowComponent = (props) => {
  const {
    zones,
    zoneType,
    colorsPalette,
    onColorsPaletteChange,
    zoneTypes
  } = props;
  const { classes, theme } = useStyles();
  const [isEditingZoneType, setIsEditingZoneType] = useState(false);
  // The selected annotation id coming from Localization context. When it changes, we need to sync
  const { selectedAnnotationQualifiedId } = useLocalizationWidget();
  const [isExpanded, setIsExpanded] = useState(false);
  const onToggleIsExpanded = useCallback(() => setIsExpanded(prevState => !prevState), []);
  // if user clicks on a zone in the map, then expand the corresponding Zone Type row
  useEffect(() => {
    if (selectedAnnotationQualifiedId && !isExpanded) {
      const expandedZone = zones.find(zone => (
        zone.spatialAnnotationId === selectedAnnotationQualifiedId.annotationId
      ));
      if (expandedZone?.type === zoneType._id) setIsExpanded(true);
    }
  }, [selectedAnnotationQualifiedId, zones, zoneType, isExpanded]);
  const { label, style = {}, _id } = zoneType;
  const isPresetZoneType = useMemo(() => PRESET_ZONE_TYPES.includes(zoneType?._id), [zoneType]);
  // Filter zones based on the zoneType
  const filteredZones = useMemo(() => zones.filter(zone => zone?.type == _id) || [], [zones, _id]);
  const { color } = style;
  // Toggle edit mode for the zone type
  const handleEditButtonClick = useCallback(() => setIsEditingZoneType(prevState => !prevState), []);
  // If there are no zones for the zone type, don't render it.
  if (isEmpty(filteredZones)) return null;
  return (
    isEditingZoneType ? (
      <Grid className={classes.newZoneTypeContainer}>
        <NewZoneTypeComponent
          zoneType={zoneType}
          onCancel={handleEditButtonClick}
          colorsPalette={colorsPalette}
        />
      </Grid>
    ) : (
      <Accordion
        expanded={isExpanded}
        onChange={onToggleIsExpanded}
        className={classnames(classes.accordion)}
        disableGutters
      >
        <AccordionSummary
          className={classes.accordionSummary}
          expandIcon={(
            <ExpandMoreIcon
              classes={{
                root: classes.icon
              }}
            />
          )}
        >
          <Grid
            className={classes.labelContainer}
          >
            <ChipIcon
              color={color || theme.palette.background.blueLightBackground}
              height="15px"
              width="15px"
            />
            <Typography
              className={classes.zoneLabel}
            >
              {label}
            </Typography>
          </Grid>
          <Grid className={classes.numberOfZonesContainer}>
            {!isPresetZoneType ? (
              <>
                <IconButton
                  data-test="tag-edit-button"
                  aria-label="Edit Button"
                  onClick={handleEditButtonClick}
                  title="Edit zone type"
                  color={isEditingZoneType ? 'primary' : 'default'}
                  size="large"
                  className={classes.iconButton}
                >
                  <Edit classes={{ root: classes.editIcon }} />
                </IconButton>
                <Grid className={classes.numberOfZones}>
                  <Typography
                    className={classes.number}
                  >
                    {filteredZones.length}
                  </Typography>
                </Grid>
              </>
            ) : (
              <Grid className={classes.numberOfZones}>
                <Typography
                  className={classes.number}
                >
                  {filteredZones.length}
                </Typography>
              </Grid>
            )}
          </Grid>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          {filteredZones?.map(zone => (
            <ZoneRowComponent
              key={zone.zoneId}
              zone={zone}
              zoneTypes={zoneTypes}
              colorsPalette={colorsPalette}
              onColorsPaletteChange={onColorsPaletteChange}
            />
          ))}
        </AccordionDetails>
      </Accordion>
    )
  );
};

ZoneTypeRowComponent.propTypes = {
  // Array of zones, each zone is an element with {_id, label, color}
  zones: PropTypes.array,
  // Object representing a zone type with {_id, label, color}
  zoneType: PropTypes.object,
  // Array of zone types
  zoneTypes: PropTypes.array,
  // Props used in NewZoneTypeComponent child of ZoneRowComponent
  colorsPalette: PropTypes.array,
  onColorsPaletteChange: PropTypes.func
};

export default ZoneTypeRowComponent;
