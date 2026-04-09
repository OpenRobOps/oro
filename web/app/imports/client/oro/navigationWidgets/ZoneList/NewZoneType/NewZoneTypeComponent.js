/**
 * Represents a new zone to add that's going to be shown
 * when create new option is selected.
 */
import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { isEqual } from 'lodash';
import { TextField, Button, Grid } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';
import { ZONE_EDIT_MODE } from '../../interactions';
import { EDIT_ACTIONS } from '../../ActiveInteractionControl';
import ChipIcon from '../../../graphics/ChipIcon';

const useStyles = makeStyles()(theme => ({
  newZoneTypeContainer: {
    display: 'flex',
    padding: '12px 8px',
    flexDirection: 'column',
    alignItems: 'flexStart',
    gap: '8px',
    borderRadius: '4px',
    background: theme.palette.background.white,
    boxShadow: `2px 2px 10px 1px ${theme.palette.boxShadow.light}`,
    borderTop: `1px solid ${theme.palette.background.brightBlue}`
  },
  colorAndLabelContainer: {
    display: 'flex',
    width: '252px',
    alignItems: 'center',
    gap: '8px'
  },
  zoneLabel: {
    color: theme.palette.text.content,
    fontSize: '13px',
    fontWeight: 400,
    padding: '5px 0'
  },
  colorChipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: '8px'
  },
  saveButton: {
    display: 'flex',
    padding: '0px 6px',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    border: `1px solid ${theme.palette.text.title}`,
    background: theme.palette.text.title,
    minWidth: '45px',
    height: '25px',
    textTransform: 'capitalize',
    fontSize: '13px',
    color: theme.palette.background.white,
    fontWeight: 500,
    '&:hover': {
      border: '0 !important',
      background: theme.palette.text.title,
    },
    '&:disabled': {
      border: '0 !important',
      color: theme.palette.text.contrastText
    },
  },
  cancelButton: {
    padding: '0px 6px',
    minWidth: '45px',
    height: '25px',
    fontSize: '13px',
    color: theme.palette.text.title,
    fontWeight: 500,
    textTransform: 'capitalize'
  },
  buttonContainer: {
    display: 'flex',
    alignSelf: 'self-end'
  },
  dropdowdnIconContainer: {
    display: 'flex',
    margin: '-10px -6px -8px'
  },
  dropdownIcon: {
    color: theme.palette.text.title,
    fontSize: '27px',
  }
}));

const NEW_ZONE_TYPE = {
  label: 'New Zone Type',
  style: { color: null }
};

const NewZoneTypeComponent = (props) => {
  const {
    onCancel,
    colorsPalette = [],
    onColorsPaletteChange,
    zoneType
  } = props;
  const { classes } = useStyles();
  const { setInteractionData, executeInteraction } = useActiveInteraction();
  // State to save data of the new zone type
  const [newZoneType, setNewZoneType] = useState(zoneType || NEW_ZONE_TYPE);
  // Handler for changing the zone label
  const handleLabelChanged = useCallback((event) => {
    const label = event.target.value;
    setNewZoneType(prevData => ({ ...prevData, label }));
  }, []);
  // Handler for saving the new zone
  const handleSaveNewZoneType = useCallback(() => {
    executeInteraction(ZONE_EDIT_MODE, EDIT_ACTIONS.SAVE);
    // Don't show the new zone type component
    onCancel();
  }, [executeInteraction, onCancel]);
  // Handler for picking a color from the palette
  const handlePickColor = useCallback((style) => {
    setNewZoneType(prevData => ({ ...prevData, style }));
  }, []);

  useEffect(() => {
    // Updates interactionData with the newly created or modified zone type.
    setInteractionData(prevData => ({
      ...prevData,
      addingNewElement: !zoneType?._id,
      modified: !isEqual(zoneType, newZoneType),
      zoneData: {
        ...prevData?.zoneData,
        zoneType: newZoneType
      }
    }));
  }, [newZoneType, zoneType, setInteractionData]);

  const handleCancelNewZone = useCallback(() => onCancel(), [onCancel]);

  return (
    <Grid className={classes.newZoneTypeContainer}>
      <Grid className={classes.colorAndLabelContainer}>
        <ChipIcon
          color={newZoneType?.style?.color}
          height="16px"
          width="16px"
        />
        <TextField
          fullWidth
          size="small"
          value={newZoneType?.label}
          onChange={handleLabelChanged}
          InputLabelProps={{
            shrink: true
          }}
          InputProps={{
            classes: {
              input: classes.zoneLabel
            }
          }}
        />
      </Grid>
      <Grid className={classes.dropdowdnIconContainer}>
        <ArrowDropDownIcon
          classes={{
            root: classes.dropdownIcon
          }}
        />
      </Grid>
      <Grid className={classes.colorChipContainer}>
        {colorsPalette?.map((color, ix) => {
          const isSelected = newZoneType.style?.color == color.color;
          return (
            <ChipIcon
              color={color?.color}
              height="24px"
              width="24px"
              opacity={1}
              onClick={handlePickColor}
              key={color.id || ix}
              withOutlineBorder={isSelected}
            />
          );
        })}
      </Grid>
      <Grid className={classes.buttonContainer}>
        <Button
          className={classes.cancelButton}
          onClick={handleCancelNewZone}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          className={classes.saveButton}
          onClick={handleSaveNewZoneType}
          disabled={!newZoneType?.style?.color}
        >
          Save
        </Button>
      </Grid>
    </Grid>
  );
};

NewZoneTypeComponent.propTypes = {
  // zoneType has to contain: {label, style, _id}
  zoneType: PropTypes.object,
  // Callback to cancel and close the section to add a new zone type
  onCancel: PropTypes.func,
  // Available colors for the new type of zone to be created
  colorsPalette: PropTypes.array,
  // Callback to select a color on colorsPalette
  onColorsPaletteChange: PropTypes.func
};

export default NewZoneTypeComponent;
