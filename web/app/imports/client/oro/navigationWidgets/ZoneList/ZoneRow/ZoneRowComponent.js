/**
 * Represents a zone. It is normally collapsed, except when being edited.
 * It also implements the widget to add a new zone and has an option to create a new zone type.
 */
import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { isEqual } from 'lodash';
import { makeStyles } from 'tss-react/mui';
import {
  AccordionSummary,
  InputLabel,
  TextField,
  AccordionDetails,
  Accordion,
  Select,
  Grid,
  MenuItem,
  Typography,
  FormHelperText,
  FormControl
} from '@mui/material';
import classnames from 'classnames';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NewZoneTypeComponent from '../NewZoneType/NewZoneTypeComponent';
import { getOptionLabel, getOptionValue } from '../../../../../lib/util';
import ChipIcon from '../../../graphics/ChipIcon';
import PlusIcon from '../../../graphics/PlusIcon';
import { useLocalizationWidget } from '../../../contexts/LocalizationWidgetContext';
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';

const useStyles = makeStyles()(theme => ({
  zoneLabel: {
    color: theme.palette.text.content,
    fontSize: '13px',
    fontWeight: theme.fontWeight.lightPlus,
    padding: '5px 0'
  },
  accordion: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    boxShadow: 'none',
    '.MuiAccordionSummary-root': {
      padding: ' 0 0 0 26px',
      minHeight: '30px !important',
      width: '98%'
    },
    '.MuiCollapse-root': {
      width: '-webkit-fill-available'
    },
    '&:before': {
      background: 'transparent',
      height: 0
    },
    '&.Mui-expanded ': {
      borderRadius: '4px',
      boxShadow: '2px 2px 10px 1px rgba(0, 0, 0, 0.30)',
      margin: '10px 0 !important',
    },
    border: '1px solid #3F93FF'
  },
  accordionSummary: {
    '& .MuiAccordionSummary-content': {
      display: 'flex',
      alignItems: 'center',
      margin: '0 !important',
    },
  },
  icon: {
    fontSize: '20px',
  },
  labelContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  optionLabel: {
    fontSize: '13px'
  },
  menuItem: {
    display: 'flex',
    gap: '8px',
  },
  inputLabel: {
    color: '#757575',
    fontSize: '14px',
    fontStyle: 'normal',
    fontWeight: 400,
    lineHeight: 'normal'
  },
  accordionDetails: {
    padding: '10px 23px 16px 32px'
  },
  newZoneTypeOpen: {
    padding: '7px 0 0 0'
  },
  zoneLabelUnselected: {
    padding: '0 2px 4px 26px',
    color: theme.palette.text.content,
    fontSize: '13px',
    fontWeight: theme.fontWeight.lightPlus,
  }
}));

const REQUIRED_MESSAGE = 'This field is Required.';
const NEW_ZONE_TYPE = 'new_zone_type';
const CREATE_NEW_ZONE_OPTION_LABEL = 'Create new';
const ZONE_TYPE_INPUT_LABEL = 'zone type';
const NEW_ZONE = { label: 'New Zone' };

const ZoneRowComponent = (props) => {
  const {
    zone = NEW_ZONE,
    zoneTypes = [],
    colorsPalette,
    onColorsPaletteChange
  } = props;
  const { classes, theme } = useStyles();
  // state to save data when textField, colorPicker and option selector change.
  const [zoneEdited, setZoneEdited] = useState(zone);
  // state: boolean. Controls when to show new zone type component
  const [isNewZoneType, setIsNewZoneType] = useState(false);
  const { zoneId, spatialAnnotationId, label, type } = zoneEdited;
  // State to save data of the new zone type
  const [newZoneType, saveNewZoneType] = useState();
  // Function to handle changes to the label of a zone
  const handleZoneLabelChange = useCallback((event) => {
    const { value } = event.target;
    setZoneEdited(prevZone => ({ ...prevZone, label: value }));
  }, []);
  // used when "Create new zone" option is clicked in the selector
  const toggleCreateNewZoneType = useCallback(() => setIsNewZoneType(prevState => !prevState), []);
  // State to control if the accordion is expanded
  const [isExpanded, setIsExpanded] = useState(false);
  // Toggle function for accordion expansion
  const onToggleIsExpanded = useCallback(() => setIsExpanded(prevState => !prevState), []);
  // Gets annotation selected data
  const { selectedAnnotationQualifiedId } = useLocalizationWidget();
  const { data: interactionData, setInteractionData } = useActiveInteraction();
  const { createNewZone, createZoneHasError } = interactionData || {};

  // Function to handle changes to the type of a zone
  const handleZoneTypeSelected = useCallback((event) => {
    const { value } = event.target;
    setZoneEdited(prevZone => ({ ...prevZone, type: value }));

    setInteractionData(prevData => ({
      ...prevData,
      createZoneHasError: false
    }));
  }, [setInteractionData]);

  // If the zone is selected on the map, it will be highlighted and editable.
  const isSelected = isEqual(selectedAnnotationQualifiedId?.annotationId, spatialAnnotationId);

  useEffect(() => {
    if (createNewZone && isEqual(NEW_ZONE, zone)) {
      setIsExpanded(true);
    }
    if (selectedAnnotationQualifiedId && !isExpanded) {
      if (isSelected) setIsExpanded(true);
    }
    if (isSelected || createNewZone) {
      setInteractionData(prevData => ({
        ...prevData,
        addingNewElement: !zoneId,
        modified: !isEqual(zone, zoneEdited),
        zoneData: {
          ...prevData?.zoneData,
          zone: {
            ...prevData?.zoneData?.zone,
            label,
            type
          },
          zoneId
        }
      }));
    }
  }, [
    selectedAnnotationQualifiedId,
    isExpanded,
    createNewZone,
    zoneEdited,
    zoneId,
    isSelected,
    zone,
    label,
    type,
    setInteractionData
  ]);

  return (
    !isSelected ? (
      <Typography className={classes.zoneLabelUnselected}>
        {label}
      </Typography>
    ) : (
      <Accordion
        expanded={isExpanded}
        onChange={onToggleIsExpanded}
        className={classes.accordion}
        id={zoneId}
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
            <TextField
              fullWidth
              size="small"
              value={label}
              onChange={handleZoneLabelChange}
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  textShadow: `0 0 ${theme.palette.text.content}`
                },
              }}
              InputLabelProps={{
                shrink: true
              }}
              InputProps={{
                classes: {
                  input: classes.zoneLabel
                }
              }}
              variant="standard"
            />
          </Grid>
        </AccordionSummary>
        <AccordionDetails
          className={classnames(classes.accordionDetails, { [classes.newZoneTypeOpen]: isNewZoneType })}
        >
          {isNewZoneType ? (
            <NewZoneTypeComponent
              onChange={saveNewZoneType}
              colorsPalette={colorsPalette}
              onColorsPaletteChange={onColorsPaletteChange}
              onCancel={toggleCreateNewZoneType}
            />
          ) : (
            <FormControl fullWidth required error={createZoneHasError}>
              <InputLabel
                className={classes.inputLabel}
                variant="standard"
                shrink
              >
                {ZONE_TYPE_INPUT_LABEL}
              </InputLabel>
              <Select
                value={type}
                onChange={handleZoneTypeSelected}
              >
                {zoneTypes?.map(option => (
                  <MenuItem
                    value={option._id}
                    key={option._id}
                  >
                    <Grid
                      className={classes.menuItem}
                    >
                      <ChipIcon
                        color={option?.style?.color || theme.palette.background.blueLightBackground}
                        height="15px"
                        width="15px"
                      />
                      <Typography className={classes.optionLabel}>
                        {getOptionLabel(option)}
                      </Typography>
                    </Grid>
                  </MenuItem>
                ))}
                {newZoneType && (
                  <MenuItem
                    value={NEW_ZONE_TYPE}
                    key={getOptionValue(newZoneType)}
                  >
                    <Grid
                      className={classes.menuItem}
                    >
                      <ChipIcon
                        color={newZoneType?.style?.color || theme.palette.background.blueLightBackground}
                        height="15px"
                        width="15px"
                      />
                      <Typography className={classes.optionLabel}>
                        {getOptionLabel(newZoneType)}
                      </Typography>
                    </Grid>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={toggleCreateNewZoneType}
                >
                  <Grid
                    className={classes.menuItem}
                  >
                    <Grid>
                      <PlusIcon />
                    </Grid>
                    <Typography className={classes.optionLabel}>
                      {CREATE_NEW_ZONE_OPTION_LABEL}
                    </Typography>
                  </Grid>
                </MenuItem>
              </Select>
              {createZoneHasError && (
                <FormHelperText>
                  {REQUIRED_MESSAGE}
                </FormHelperText>
              )}
            </FormControl>
          )}
        </AccordionDetails>
      </Accordion>
    )
  );
};

ZoneRowComponent.propTypes = {
  // An array of objects, where each object represents a zone type with
  // properties: _id, label, and color
  zoneTypes: PropTypes.array,
  // Represents a zone with {_id, label, type}
  zone: PropTypes.object,
  // Props used in NewZoneTypeComponent
  colorsPalette: PropTypes.array,
  onColorsPaletteChange: PropTypes.func
};

export default ZoneRowComponent;
