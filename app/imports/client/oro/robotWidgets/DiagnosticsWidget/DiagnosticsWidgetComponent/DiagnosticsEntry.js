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
import { useCallback } from 'react';
import { Avatar, IconButton } from '@mui/material';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircle';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';
// ORO modules
import { StyledTableCell, StyledTableRow } from '../../../util/DefaultTable';
import StaleIcon from '../../../graphics/ROSDiagnosticIcon/DiagnosticsStaleIcon';
import OkIcon from '../../../graphics/ROSDiagnosticIcon/DiagnosticsOkIcon';
import WarningIcon from '../../../graphics/ROSDiagnosticIcon/DiagnosticsWarningIcon';
import ErrorIcon from '../../../graphics/ROSDiagnosticIcon/DiagnosticsErrorIcon';
import DiagnosticsEntryKeyValues from './DiagnosticsEntryKeyValues';

// ROS Diagnostics values.
const DIAG_VALUES = {
  OK: 0,
  WARN: 1,
  ERROR: 2,
  STALE: 3
};

const DIAG_VALUES_BUTTONS = ['ERROR', 'WARNING', 'STALE', 'ALL'];

const useStyles = makeStyles()(theme => ({
  icon: {
    width: '18px',
    height: '18px'
  },
  okIcon: {
    fontSize: 'small'
  },
  inactiveCell: {
    color: theme.palette.incidents.inactive
  },
  iconButton: {
    padding: 0,
    fontSize: '1rem !important'
  }
}));

const DiagnosticsEntry = (props) => {
  const { level, onClick, message, name, isActive, keyValues, onExpand,
    expanded } = props;
  const { theme, classes } = useStyles();

  const handleClick = useCallback(() => {
    onClick?.(name);
  }, [onClick, name]);

  const handleExpand = useCallback(() => {
    onExpand?.(name);
  }, [onExpand, name]);

  let statusObj;

  /**
   * Chooses the status icon and color to display according to the status level
   */
  switch (level) {
    case DIAG_VALUES.OK:
      statusObj = {
        icon: <OkIcon />,
        color: theme.palette.background.white,
        backgroundColor: theme.palette.incidents.ok
      };
      break;
    case DIAG_VALUES.WARN:
      statusObj = {
        icon: <WarningIcon />,
        color: theme.palette.incidents.warning,
        backgroundColor: theme.palette.text.content
      };
      break;
    case DIAG_VALUES.ERROR:
      statusObj = {
        icon: <ErrorIcon />,
        color: theme.palette.incidents.error,
        backgroundColor: theme.palette.background.white
      };
      break;
    case DIAG_VALUES.STALE:
      statusObj = {
        icon: <StaleIcon />,
        color: theme.palette.incidents.inactive,
        backgroundColor: theme.palette.background.white
      };
      break;
    default:
      statusObj = {
        icon: <RemoveCircleOutlineIcon />,
        color: theme.palette.incidents.inactive,
        backgroundColor: theme.palette.background.white
      };
      break;
  }
  return (
    <>
      <StyledTableRow>
        <StyledTableCell width="10%">
          <Avatar
            className={classes.icon}
          >
            {statusObj.icon}
          </Avatar>
        </StyledTableCell>
        <StyledTableCell width="40%" className={isActive ? '' : classes.inactiveCell}>
          {name}
        </StyledTableCell>
        <StyledTableCell width="45%" className={isActive ? '' : classes.inactiveCell}>
          {message}
        </StyledTableCell>
        <StyledTableCell width="5%">
          {onClick ? (
            <IconButton
              aria-label="expand row"
              size="small"
              className={classes.iconButton}
              onClick={handleClick}
            >
              <KeyboardArrowRightIcon className={classes.iconButton} />
            </IconButton>
          ) : null}
          {onExpand ? (
            <IconButton
              aria-label="expand row"
              size="small"
              className={classes.iconButton}
              onClick={handleExpand}
            >
              {expanded
                ? <ExpandLessIcon className={classes.iconButton} />
                : <ExpandMoreIcon className={classes.iconButton} />}
            </IconButton>
          ) : null}
        </StyledTableCell>
      </StyledTableRow>
      {expanded && keyValues && (
        <StyledTableRow>
          <StyledTableCell colSpan={4}>
            <DiagnosticsEntryKeyValues keyValues={keyValues} />
          </StyledTableCell>
        </StyledTableRow>
      )}
    </>
  );
};

DiagnosticsEntry.propTypes = {
  level: PropTypes.number,
  message: PropTypes.string,
  name: PropTypes.string,
  onClick: PropTypes.func,
  isActive: PropTypes.bool,
  keyValues: PropTypes.object,
  expanded: PropTypes.bool,
  onExpand: PropTypes.func
};

export { DIAG_VALUES, DIAG_VALUES_BUTTONS };
export default DiagnosticsEntry;
