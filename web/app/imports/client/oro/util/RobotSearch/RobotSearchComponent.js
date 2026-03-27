/**
 * Robot Search
 * Component that uses auto complete input for finding robots for a specific company
 * It is self sufficient as it uses the searchManager to find robots
 * given a string, company and (optionally) a collectionId.
 * The queries will always be limited in the backend to what a user
 * can see, even if no companyId/collectionId or string are provided
 */
import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { withStyles } from 'tss-react/mui';
import { TextField, Typography, Chip, Autocomplete } from '@mui/material';
import { Bot } from 'lucide-react';
// ORO modules
import { ID_TYPE_ROBOT } from '../../../../shared/constants';
import { DarkModeContext } from '../../contexts/DarkModeContext';
import LoadingBar from '../LoadingBar';
import WrapWithTooltip from '../WrapWithTooltip';


const styles = theme => ({
  autocompleteInput: {
    '&.MuiOutlinedInput-root': {
      padding: '5px',
      color: '#FAF0F0',
    },
  },
  autocompleteInputFullscreen: {
    '&.MuiOutlinedInput-root': {
      padding: '5px',
      color: 'white',
      backgroundColor: theme.palette.background.black,
      border: '1px solid white'
    }
  },
  listboxFullScreen: {
    backgroundColor: theme.palette.background.black,
    color: theme.palette.background.lightGray
  },
  optionFullScreen: {
    '&[data-focus="true"]': {
      backgroundColor: theme.palette.background.lightGray,
      color: theme.palette.text.content,
      fontSize: '14px'
    },
  },
  popupIndicator: {
    color: 'white'
  },
  searchBoxContainer: {
    background: '#0E0918',
    border: '1px solid #3E3155',
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
    fontSize: '13px',
    position: 'relative',
    lineHeight: 'unset',
    display: 'flex',
    alignItems: 'center'
  },
  chipTag: {
    background: '#3A285A',
    borderRadius: '5px',
    color: '#FAF0F0',
    margin: '2px',
    fontSize: '13px',
    maxHeight: '26px'
  },
  chipTagRobot: {
    cursor: 'pointer'
  },
  chipHover: {
    '&:hover': {
      backgroundColor: '#4A3570'
    }
  },
  deleteIcon: {
    color: '#BEAEDD !important',
    '&:hover': {
      color: '#FAF0F0 !important',
    }
  },
  hiddenTextInputRoot: {
    width: '0px',
    padding: '0',
    marginLeft: 'auto',
    overflow: 'hidden',
  },
  showTextInputRoot: {
    width: '100%',
    minWidth: '175px',
    padding: '0 10px',
  },
  showTextInputInput: {
    fontSize: '14px',
    justifySelf: 'flex-end',
    color: '#FAF0F0',
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
  optionTypography: {
    fontSize: '14px',
  }
});

class RobotSearch extends React.Component {
  state = {
    robots: [],
    optionsOpened: false
  }

  componentDidMount() {
    // Fetch some initial values on mount so the list
    // is not empty when first opened.
    this.dispatchNewQuery();
  }

  /**
   * Saves the selected robot entity in the state
   * and passes the robotId to the parent with a callback
   * @param {Object} event
   * @param {Object} robotEntity
   */
  setSelectedRobotId = (event, robotEntity) => {
    if (robotEntity) {
      const { entityId: robotId } = robotEntity;
      const { selectRobotCallback } = this.props;
      if (selectRobotCallback) {
        selectRobotCallback(robotId);
      }
    }
  }

  /**
   * Removes the robot from the context when the chip "cross" is clicked
   */
  handleDeleteRobot = () => {
    const { selectRobotCallback } = this.props;
    if (selectRobotCallback) {
      selectRobotCallback(null);
    }
  }

  handleOptionsOpen = () => this.setState({ optionsOpened: true });

  handleOptionsClose = () => this.setState({ optionsOpened: false });

  /**
   * Event handler for input changes in the Autocomplete
   * NOTE(herchu) Recent material-ui/lab version adds a third parameter
   * with a 'reason' for the callback, with value "input". We simply ignore
   * this argument, but is declared here for clarity.
   * See https://inorbit.atlassian.net/browse/IO-3988
   */
  // eslint-disable-next-line no-unused-vars
  handleInputChange = (event, value, reason) => {
    this.dispatchNewQuery(value);
  }

  /**
   * Given a string, it dispatches a query to find robots whose name or id
   * match the string provided.
   * It also filters based on the prop selectedCollectionId.
   * If selectedCollectionId is not passed, it defaults
   * to ALL robots the user can see in the company
   * @param {String} queryString
   */
  dispatchNewQuery = (queryString) => {
    const {
      searchEntitiesMeteorCall
    } = this.props;
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
          this.setState({ robots: result });
        }
      });
    }
  };

  render() {
    const { robots, optionsOpened } = this.state;
    const {
      disabled, label = '', classes, dataTest, disablePortal = true,
      selectedRobot, isRobotLoading, robotData
    } = this.props;
    const { isDarkMode } = this.context;

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
        {(selectedRobot || !isRobotLoading) && (
          <Autocomplete
            open={optionsOpened}
            onOpen={this.handleOptionsOpen}
            onClose={this.handleOptionsClose}
            disableClearable
            // Don't detach from DOM, otherwise it doesn't work full-screen
            disablePortal={disablePortal}
            disabled={disabled}
            value={selectedRobot}
            // NOTE: onInputChange added a third param in material-ui/lab@4.0.0-alpha.56
            // which will break this call if we update versions.
            onInputChange={this.handleInputChange}
            options={robots}
            getOptionLabel={option => ((option && option.label) || '')}
            onChange={this.setSelectedRobotId}
            isOptionEqualToValue={(option, value) => option?._id == value?._id}
            classes={
              isDarkMode ? {
                inputRoot: classes.autocompleteInputFullscreen,
                popupIndicator: classes.popupIndicator,
                listbox: classes.listboxFullScreen,
                option: classes.optionFullScreen,
                popper: classes.popper,
              } : {
                inputRoot: classes.autocompleteInput,
                option: classes.optionTypography,
                popper: classes.popper,
              }
            }
            renderOption={(props, option) => (
              <Typography {...props}>
                {option.label}
              </Typography>
            )}
            renderInput={params => (
              <div className={classes.chipTagContainer}>
                {/*activeFilter*/ true ? (
                  <>
                    {selectedRobot && !optionsOpened && (
                      WrapWithTooltip(robotVersionTooltip, (
                        <Chip
                          icon={<Bot size={16} color="#BEAEDD" />}
                          className={classnames(classes.chipTagRobot, classes.chipTag)}
                          classes={{ deleteIcon: classes.deleteIcon, clickable: classes.chipHover }}
                          label={isRobotLoading ? (
                            <LoadingBar height="10px" width="80px" />
                          ) : (
                            <Typography className={classes.filterLabel}>
                              {selectedRobot.label}
                            </Typography>
                          )}
                          onClick={this.handleOptionsOpen}
                          onDelete={this.handleDeleteRobot}
                        />
                      ))
                    )}
                    <TextField
                      {...params}
                      onFocus={this.handleOptionsMouseDown}
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
  }
}

RobotSearch.contextType = DarkModeContext;

RobotSearch.propTypes = {
  classes: PropTypes.object,
  className: PropTypes.string,
  companyId: PropTypes.string,
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

export default withStyles(RobotSearch, styles, { withTheme: true });
