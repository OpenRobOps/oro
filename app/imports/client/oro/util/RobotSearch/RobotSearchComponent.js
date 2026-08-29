/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * Robot Search
 * Component that uses auto complete input for finding robots for a specific company
 * It is self sufficient as it uses the searchManager to find robots
 * given a string, company and (optionally) a collectionId.
 * The queries will always be limited in the backend to what a user
 * can see.
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { makeStyles } from 'tss-react/mui';
import { TextField, Typography, Chip, Autocomplete, Backdrop } from '@mui/material';
import { Bot, CircleX } from 'lucide-react';
// ORO modules
import { ID_TYPE_ROBOT } from '../../../../shared/constants';
import { DarkModeContext } from '../../contexts/DarkModeContext';
import LoadingBar from '../LoadingBar';
import WrapWithTooltip from '../WrapWithTooltip';


const useStyles = makeStyles()(theme => ({
  autocompleteInput: {
    '&.MuiOutlinedInput-root': {
      padding: '5px',
      color: theme.palette.text.primary,
    },
  },
  autocompleteInputFullscreen: {
    '&.MuiOutlinedInput-root': {
      padding: '5px',
      color: theme.palette.background.white,
      backgroundColor: theme.palette.background.black,
      border: `1px solid ${theme.palette.background.white}`
    }
  },
  popupIndicator: {
    color: theme.palette.background.white
  },
  searchBoxContainer: {
    background: theme.palette.background.black,
    border: `1px solid ${theme.palette.background.borderLight}`,
    borderRadius: '4px',
    maxWidth: '200px',
    width: '100%',
    position: 'relative'
  },
  notchedOutline: {
    border: 'initial'
  },
  labelStyle: {
    zIndex: 0,
    transform: 'translate(10px, 10px)',
  },
  filterLabel: {
    fontSize: '11px',
    color: theme.palette.text.buttonText,
    position: 'relative',
    lineHeight: 'normal',
    display: 'flex',
    alignItems: 'center'
  },
  chipTag: {
    background: theme.palette.background.borderLight,
    border: `1px solid ${theme.palette.background.borderLight}`,
    borderRadius: '4px',
    color: theme.palette.text.buttonText,
    height: '24.6px',
    gap: '4px',
    padding: '0 7px',
    '& .MuiChip-label': {
      padding: 0,
    },
    '& .MuiChip-icon': {
      margin: 0,
    },
    '& .MuiChip-deleteIcon': {
      margin: 0,
    },
  },
  chipTagRobot: {
    cursor: 'pointer'
  },
  chipHover: {
    '&:hover': {
      backgroundColor: theme.palette.background.borderMedium
    }
  },
  deleteIcon: {
    color: `${theme.palette.text.buttonText} !important`,
    '&:hover': {
      color: `${theme.palette.text.primary} !important`,
    }
  },
  hiddenTextInputRoot: {
    // The <input> itself is hidden via hiddenTextInputInput (display: none); keep the
    // root sized to its content so the dropdown arrow (endAdornment) stays visible when
    // a robot is selected. Collapsing the root to width 0 / overflow hidden also hid the
    // arrow, which only reappeared after deselecting the robot.
    padding: '0',
    marginLeft: 'auto',
  },
  showTextInputRoot: {
    width: '100%',
    minWidth: '175px',
    padding: '0 0 0 10px', // no right padding: keeps the chevron in place when opened
  },
  showTextInputInput: {
    fontSize: '14px',
    justifySelf: 'flex-end',
    color: theme.palette.text.primary,
  },
  searchBoxContainerWithChip: {
    minWidth: '350px',
    maxWidth: 'fit-content'
  },
  chipTagContainer: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '3px',
  },
  noChipInput: {
    fontSize: '14px',
    padding: '0 !important'
  },
  optionsOpened: {
    width: '100%',
    marginLeft: 'auto',
    padding: '0 10px'
  },
  hiddenTextInputInputRoot: {
    padding: '0'
  },
  hiddenTextInputInput: {
    display: 'none'
  },
  popper: {
    width: '200px !important',
    right: 0,
    zIndex: '1300 !important',
  },
  outlinedInput: {
    padding: '6px !important'
  },
}));

const RobotSearch = (props) => {
  const {
    disabled, label = '', dataTest, disablePortal = true,
    selectedRobot, isRobotLoading, robotData,
    selectRobotCallback, searchEntitiesMeteorCall
  } = props;
  const { classes, theme } = useStyles();
  const { isDarkMode } = useContext(DarkModeContext);

  const [robots, setRobots] = useState([]);
  const [optionsOpened, setOptionsOpened] = useState(false);
  const inputRef = useRef(null);

  // Autocomplete closes on input blur. When opened from the chip the input is hidden
  // (display: none) until this re-render, so focus it here; otherwise there is never a
  // blur and the list stays open while clicking elsewhere.
  useEffect(() => {
    if (optionsOpened) inputRef.current?.focus();
  }, [optionsOpened]);

  /**
   * Given a string, it dispatches a query to find robots whose name or id
   * match the string provided.
   * It also filters based on the prop selectedCollectionId.
   * If selectedCollectionId is not passed, it defaults
   * to ALL robots the user can see in the company
   * @param {String} queryString
   */
  const dispatchNewQuery = useCallback((queryString) => {
    const filters = {};
    const entityTypes = [ID_TYPE_ROBOT];
    if (searchEntitiesMeteorCall) {
      searchEntitiesMeteorCall({
        entityTypes,
        filters,
        queryString
      }, (error, result) => {
        if (error) {
          console.error(error);
        } else {
          setRobots(result);
        }
      });
    }
  }, [searchEntitiesMeteorCall]);

  useEffect(() => {
    // Fetch some initial values on mount so the list
    // is not empty when first opened.
    dispatchNewQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Saves the selected robot entity in the state
   * and passes the robotId to the parent with a callback
   * @param {Object} event
   * @param {Object} robotEntity
   */
  const setSelectedRobotId = (event, robotEntity) => {
    if (robotEntity) {
      const { entityId: robotId } = robotEntity;
      if (selectRobotCallback) {
        selectRobotCallback(robotId);
      }
    }
  };

  /**
   * Removes the robot from the context when the chip "cross" is clicked
   */
  const handleDeleteRobot = () => {
    if (selectRobotCallback) {
      selectRobotCallback(null);
    }
  };

  const handleOptionsOpen = () => setOptionsOpened(true);

  const handleOptionsClose = () => setOptionsOpened(false);

  /**
   * Event handler for input changes in the Autocomplete
   * NOTE(herchu) Recent material-ui/lab version adds a third parameter
   * with a 'reason' for the callback, with value "input". We simply ignore
   * this argument, but is declared here for clarity.
   * See https://inorbit.atlassian.net/browse/IO-3988
   */
  // eslint-disable-next-line no-unused-vars
  const handleInputChange = (event, value, reason) => {
    dispatchNewQuery(value);
  };

  const showTextInput = optionsOpened || !selectedRobot;

  const robotVersionTooltip = selectedRobot && `Agent version: ${(robotData && robotData.version) || '--'}`;

  return (
    <div
      data-test={dataTest || 'robot-search'}
      className={
        classnames(
          classes.searchBoxContainer
        )
      }
    >
      {/* Same modal behaviour as Select/Popover: while open, clicks outside only close the list */}
      <Backdrop invisible open={optionsOpened} onClick={handleOptionsClose} sx={{ zIndex: 1299 }} />
      {(selectedRobot || !isRobotLoading) && (
        <Autocomplete
          open={optionsOpened}
          onOpen={handleOptionsOpen}
          onClose={handleOptionsClose}
          disableClearable
          // Don't detach from DOM, otherwise it doesn't work full-screen
          disablePortal={disablePortal}
          disabled={disabled}
          value={selectedRobot}
          // NOTE: onInputChange added a third param in material-ui/lab@4.0.0-alpha.56
          // which will break this call if we update versions.
          onInputChange={handleInputChange}
          options={robots}
          getOptionLabel={option => ((option && option.label) || '')}
          onChange={setSelectedRobotId}
          isOptionEqualToValue={(option, value) => option?.entityId == value?.entityId}
          classes={
            isDarkMode ? {
              inputRoot: classes.autocompleteInputFullscreen,
              popupIndicator: classes.popupIndicator,
              popper: classes.popper,
            } : {
              inputRoot: classes.autocompleteInput,
              popper: classes.popper,
            }
          }
          renderInput={params => (
            <div className={classes.chipTagContainer}>
              {/*activeFilter*/ true ? (
                <>
                  {selectedRobot && !optionsOpened && (
                    WrapWithTooltip(robotVersionTooltip, (
                      <Chip
                        icon={<Bot size={20} color={theme.palette.text.buttonText} />}
                        deleteIcon={<CircleX size={16} color={theme.palette.text.buttonText} />}
                        className={classnames(classes.chipTagRobot, classes.chipTag)}
                        classes={{ deleteIcon: classes.deleteIcon, clickable: classes.chipHover }}
                        label={isRobotLoading ? (
                          <LoadingBar height="10px" width="80px" />
                        ) : (
                          <Typography className={classes.filterLabel}>
                            {selectedRobot.label}
                          </Typography>
                        )}
                        onClick={handleOptionsOpen}
                        onDelete={handleDeleteRobot}
                      />
                    ))
                  )}
                  <TextField
                    {...params}
                    inputRef={inputRef}
                    label={label}
                    variant="standard"
                    InputProps={{
                      ...params.InputProps,
                      disableUnderline: true,
                      classes: showTextInput
                        ? { input: classes.showTextInputInput }
                        : {
                          input: classes.hiddenTextInputInput,
                          root: classes.hiddenTextInputInputRoot
                        }
                    }}
                    classes={showTextInput
                      ? { root: classes.showTextInputRoot }
                      : { root: classes.hiddenTextInputRoot }}
                  />
                </>
              ) : (
                WrapWithTooltip(robotVersionTooltip, (
                  <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      classes: {
                        input: classes.noChipInput,
                        notchedOutline: classes.notchedOutline,
                        outlinedInput: classes.outlinedInput
                      }
                    }}
                    InputLabelProps={{
                      classes: {
                        outlined: classes.labelStyle
                      }
                    }}
                  />
                ), { withoutDivWrapper: true }))}
            </div>
          )}
        />
      )}
    </div>
  );
};

RobotSearch.propTypes = {
  classes: PropTypes.object,
  className: PropTypes.string,
  label: PropTypes.string,
  activeFilter: PropTypes.object,
  robots: PropTypes.array,
  selectedCollectionId: PropTypes.string,
  selectRobotCallback: PropTypes.func,
  handleDeleteActiveFilter: PropTypes.func,
  searchEntitiesMeteorCall: PropTypes.func,
  disabled: PropTypes.bool,
  dataTest: PropTypes.string,
  // whether to detach from DOM, default to true
  disablePortal: PropTypes.bool,
  robotData: PropTypes.object, // Selected robot additional data
  selectedRobot: PropTypes.object, // robot selected for the Material UI Autocomplete
  isRobotLoading: PropTypes.bool // selected robot is loading
};

export default RobotSearch;
