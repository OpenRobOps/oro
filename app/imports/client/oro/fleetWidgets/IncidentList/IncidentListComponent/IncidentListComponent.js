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
 * IncidentList Component
 *
 * Display a list of incidents (statuses) from all robots in the fleet.
 *
 * Meteor-agnostic component.
 */
import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { isEmpty, isEqual, find } from 'lodash';
import classnames from 'classnames';
import {
  Table,
  TableHead,
  TableSortLabel,
  TableFooter
} from '@mui/material';
import { CircleDot, CircleCheckBig } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
// ORO modules
import {
  sortIncidentsByRobotStatus,
  INCIDENT_STATUS_NEW,
  getIncidentMessage,
  ICM_SEV_2,
  ICM_SEV_ALL
} from '../../../../../shared/alerts';
import OnFeedbackContext from '../../../contexts/OnFeedbackContext';
import { StyledTableBody, StyledTableCell, StyledTableContainer, StyledTableRow } from '../../../util/DefaultTable';
import LabelZeroData from '../../../graphics/op/zeroDataIcons/LabelZeroData';
import NoDataIcon from '../../../graphics/op/NoDataIcon';
import { formatDuration, formatTimeInterval } from '../../../../../lib/util';
import { legacyWithStyles } from '../../../util/withStyles';
/*
TODO(herchu) Show proper timestamps with HH:mm:ss ? or Ago()
TODO(herchu) Status attribute only shows an attributeId;
needs to show better data (change when showing Incidents)
TODO(herchu) Data column needs the evaluated value. e.g. "80%".
How the status does not have this data
*/

const styles = theme => ({
  severityBadge: {
    borderRadius: '5px',
    fontWeight: '500',
    fontSize: '0.625rem',
    width: '36px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    display: 'flex',
    fontSize: '0.9rem'
  },
  notSolvedTypography: {
    fontWeight: theme.fontWeight.bold
  },
  solvedTypography: {
    fontSize: '0.8125rem',
    lineHeight: '1.25em',
  },
  expandIcon: {
    fontSize: '1.5rem',
    color: theme.palette.text.title
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center'
  },
  footer: {
    bottom: 0,
    position: 'sticky',
    zIndex: 2,
    borderTop: `1px solid ${theme.palette.background.borderLight}`,
    color: theme.palette.text.content
  },
  emptyCell: {
    padding: '0 25px' // simulation of content, as there are empty cells that
    // don't take all the width assigned making the cells not aligned.
  },
  // ZeroData Experience:
  severityBadgeZeroData: {
    opacity: 0.5,
  },
  tableCellZeroData: {
    display: 'flex',
    padding: '8px'
  },
  cursorInactive: {
    cursor: 'text'
  },
  expandIconZeroData: {
    color: theme.palette.zeroData.gray
  },
  selectedRow: {
    background: `${theme.palette.primary.lighter} !important`
  }
});

// Variables to define how incidents are being sorted
// TODO(herchu) Rewrite as an enum: const SORT = { ROBOT: 'robot', ... }
const SORT_ROBOT = 'robot';
const SORT_TIME = 'time';
const SORT_STATUS = 'status';
const SORT_COMP = 'component';
const SORT_PRIO = 'fleet_priority';
const SORT_SEV = 'severity';

const IncidentListWidget = (props) => {
  const { classes, theme, incidents, robotsMap, selectedIncident, isZeroData } = props;

  const [sortBy, setSortBy] = React.useState(SORT_STATUS);
  const [sortAsc, setSortAsc] = React.useState(true);
  const [sortedRows, setSortedRows] = React.useState(null);

  // Receive global user grants as context (kept for parity with the class'
  // contextType subscription; the value itself is not used here)
  React.useContext(OnFeedbackContext);

  // Reference to the <Table> component so we can scroll into rows when selected
  const tableRef = React.useRef(null);

  // Caches for table row click event handlers, memoized by incidentId
  const tableRowClickHandlers = React.useRef({});

  /**
   * Called when an item was clicked. Takes care of marking item as selected,
   * and triggers the callback function with its id (or null if deselected)
   */
  const handleIncidentClicked = (id) => {
    const { selectedIncident, onSelectedIncidentChange } = props;
    // If already selected, and clicked, then deselect it
    const nextSelected = selectedIncident == id ? null : id;
    onSelectedIncidentChange && onSelectedIncidentChange(nextSelected);
  };
  // Cached row handlers must always call the latest handleIncidentClicked
  // (which closes over the current props), so route them through a ref.
  const handleIncidentClickedRef = React.useRef();
  handleIncidentClickedRef.current = handleIncidentClicked;

  /**
   * Generate and/or return an onChanged event handler, given a unique identifier
   * (userId, collectionId).
   */
  const getTableRowClickHandler = (incidentId) => {
    // If no click handler exists for this id, create one.
    if (!(incidentId in tableRowClickHandlers.current)) {
      tableRowClickHandlers.current[incidentId] =
        event => handleIncidentClickedRef.current(incidentId, event);
    }
    return tableRowClickHandlers.current[incidentId];
  };

  /**
   * Takes sortBy and sortAsc from the state and depending on the sort criteria,
   * it's going to create a ordered list of incidents, replacing the state
   * sortedRows with it. As we want to have the list always sorted, it's called
   * when the component it's mounted and updated.
   */
  const sortRows = () => {
    const newSortedRows = [...incidents]; // clones the array
    sortIncidents(newSortedRows, sortBy, sortAsc);
    setSortedRows(newSortedRows);
  };

  // Previous values, to replicate the class' prevProps comparisons in
  // componentDidUpdate (these effects run after every render, like didUpdate)
  const prevSelectedIncidentRef = React.useRef(selectedIncident);
  const prevIncidentsRef = React.useRef(incidents);
  const mountedRef = React.useRef(false);

  /**
   * When the selected incident changes, scroll into it to display it.
   */
  React.useEffect(() => {
    const prevSelectedIncident = prevSelectedIncidentRef.current;
    prevSelectedIncidentRef.current = selectedIncident;
    if (selectedIncident && selectedIncident != prevSelectedIncident) {
      if (tableRef.current) { // if already mounted and ref is ready
        // StyledTableBody is MUI's TableBody, which forwards its ref to the
        // underlying <tbody> element, so the ref already holds the DOM node
        const node = tableRef.current;
        // Find the child node we want to scroll to, using the attribute data-id
        if (node) {
          const child = node && find(
            node.childNodes, n => n.getAttribute('data-id') == selectedIncident
          );
          // node.parentNode give us the table,
          // and node.parentNode.parentNode the div container scrolleable
          const container = node.parentNode.parentNode;
          // Get the size and position of the container and the child
          var childRect = child && child.getBoundingClientRect();
          var containertRect = container && container.getBoundingClientRect();
          if (childRect && containertRect) {
            // The size of the container viewable area
            var containerViewableArea = {
              height: parent.clientHeight,
              width: parent.clientWidth
            };
            // The child is viewable in that area?
            var isViewable = (childRect.top >= containertRect.top)
              && (childRect.bottom <= containertRect.top + containerViewableArea.height);
            // If is not, scroll the container
            if (!isViewable) {
              container.scrollTop = (childRect.top + container.scrollTop) - containertRect.top;
            }
            // TODO(Clara) Child.scrollview() was causing buggy behaviour and
            // { behaviour: 'smooth' } works too slow. Consider implementing
            // a better approach, perhaps using a library.
          }
        }
      }
    }
  });

  React.useEffect(() => {
    if (!mountedRef.current) {
      // componentDidMount: always build the initial sorted list
      mountedRef.current = true;
      prevIncidentsRef.current = incidents;
      sortRows();
      return;
    }
    const prevIncidents = prevIncidentsRef.current;
    prevIncidentsRef.current = incidents;
    if (
      (isEmpty(sortedRows) && !isEmpty(incidents))
      || !isEqual(prevIncidents, incidents)
    ) {
      // invalidate cached sorted list
      sortRows();
    }
  });

  /**
   * Click handler to sort by priority - simply calls handleSortChange()
   */
  const handleSortByPriority = () => { // eslint-disable-line no-unused-vars
    handleSortChange(SORT_PRIO);
  };

  /**
   * Click handler to sort by robot - simply calls handleSortChange()
   */
  const handleSortByRobot = () => {
    handleSortChange(SORT_ROBOT);
  };

  /**
   * Click handler to sort by time - simply calls handleSortChange()
   */
  const handleSortByTime = () => {
    handleSortChange(SORT_TIME);
  };

  /**
   * Click handler to sort by status - simply calls handleSortChange()
   */
  const handleSortByStatus = () => {
    handleSortChange(SORT_STATUS);
  };

  /**
   * Click handler to sort by component - simply calls handleSortChange()
   */
  const handleSortByComponent = () => {
    handleSortChange(SORT_COMP);
  };

  /**
   * Click handler to sort by severity - simply calls handleSortChange()
   */
  const handleSortBySeverity = () => {
    handleSortChange(SORT_SEV);
  };

  /*
    Changes what sorting will be done in sortIncidents, either by changing which
    variable will be checked in the sort or by
   */
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      sortIncidents(sortedRows, newSortBy, !sortAsc); // sorts sortedRows state in place
      setSortAsc(!sortAsc);
    } else {
      sortIncidents(sortedRows, newSortBy, true); // sorts sortedRows state in place
      setSortBy(newSortBy);
      setSortAsc(true);
    }
  };

  /*
    Sort incidents by severity
  */
  const sortBySeverity = compFn => (a, b) => {
    const robotASev = a.highestSeverity;
    const robotBSev = b.highestSeverity;
    return compFn(robotASev, robotBSev) || sortByRobot(compFn)(a, b);
  };

  /*
    Sort incidents by the component name or component id
  */
  const sortByComponent = compFn => (a, b) => {
    const robotAComp = (a.latestEvent && a.latestEvent.name)
      || (a.componentsIds && a.componentsIds[0]);
    const robotBComp = (b.latestEvent && b.latestEvent.name)
      || (b.componentsIds && b.componentsIds[0]);
    // For same components, compare by robot, then by time
    return compFn(robotAComp, robotBComp) || sortByRobot(compFn)(a, b);
  };

  /*
    Handle sorting of incidents by robot name
   */
  const sortByRobot = compFn => (a, b) => {
    const robotA = robotsMap[a.robotId] && robotsMap[a.robotId].name;
    const robotAName = robotA && robotA.toLowerCase();
    const robotB = robotsMap[b.robotId] && robotsMap[b.robotId].name;
    const robotBName = robotB && robotB.toLowerCase();
    return compFn(robotAName, robotBName) || sortByTime(compFn)(a, b);
  };

  /*
    Handle sorting of incidents by time last updated stamps
   */
  const sortByTime = compFn => (a, b) => {
    const robotAts = a.resolvedAt || a.updatedAt || a.createdAt;
    const robotBts = b.resolvedAt || b.updatedAt || b.createdAt;
    return compFn(robotBts, robotAts);
  };

  /*
    Handle sorting of incidents by status
   */
  const sortByStatus = compFn => (a, b) => {
    if (a.status == b.status) {
      const tA = a.resolvedAt || a.updatedAt || a.createdAt;
      const tB = b.resolvedAt || b.updatedAt || b.createdAt;
      return tA < tB ? 1 : -1;
    }
    return compFn(a.status, b.status);
  };

  /*
    Compares two variables, returns values for the array sort function
   */
  const _sorter = asc => (_a, _b) => {
    if (asc) {
      if (_a > _b) return 1;
      if (_a < _b) return -1;
      return 0;
    } else {
      if (_a > _b) return -1;
      if (_a < _b) return 1;
      return 0;
    }
  };

  /*
   * Sorts an incidents list.
   * Depending on the selected sort criteria (sort by, ascending), it will
   * use different sorting functions.
   * It sorts the incidents array _in place_ (for efficiency); so as this is used to sort
   * an array already part of state, make sure some state change is performed
   * outside this function to force a re-render.
   */
  const sortIncidents = (incidentsToSort, newSortBy, newSortAsc) => {
    if (!incidentsToSort) {
      return;
    }
    const compFn = _sorter(newSortAsc); // compare function, asc or desc
    switch (newSortBy) {
      case SORT_ROBOT:
        incidentsToSort.sort(sortByRobot(compFn));
        break;
      case SORT_TIME:
        incidentsToSort.sort(sortByTime(compFn));
        break;
      case SORT_STATUS:
        incidentsToSort.sort(sortByStatus(compFn));
        break;
      case SORT_COMP:
        incidentsToSort.sort(sortByComponent(compFn));
        break;
      case SORT_SEV:
        incidentsToSort.sort(sortBySeverity(compFn));
        break;
      case SORT_PRIO: {
        // HACK(herchu) This is an exception and is not done in place because the way
        // sortIncidentsByRobotStatus was originally written. So this one does not
        // really sort in place, and updates state.sortedRows instead.
        setSortedRows(sortIncidentsByRobotStatus(incidentsToSort));
        break;
      }
      default:
      // ignore
    }
  };

  /**
   * Returns a model of what we can find if we have robots returning a design simulating data.
   */
  const renderZeroData = () => {
    const { darkBlue } = theme.palette.text;
    const incidentsZeroData = ICM_SEV_ALL;
    return incidentsZeroData.map((SEV) => (
      <StyledTableRow
        key={SEV}
      >
        <StyledTableCell width="10%">
          <LabelZeroData
            backgroundColor={theme.palette.severityColor[SEV]}
            className={classes.severityBadgeZeroData}
            width="36px"
            borderRadius="5px"
            height="17px"
          />
        </StyledTableCell>
        <StyledTableCell width="15%">
          <div className={classes.iconContainer}>
            <LabelZeroData
              width="13px"
              height="14px"
              borderRadius="10px"
              margin="0 2px 0 0"
            />
            <LabelZeroData
              borderRadius="10px"
              width="47px"
              height="13px"
            />
          </div>
        </StyledTableCell>
        <StyledTableCell width="20%">
          <LabelZeroData
            borderRadius="10px"
            width="80px"
            height="13px"
          />
        </StyledTableCell>
        <StyledTableCell width="20%">
          <LabelZeroData
            borderRadius="10px"
            width="47px"
            height="13px"
          />
        </StyledTableCell>
        <StyledTableCell width="20%">
          <LabelZeroData
            borderRadius="10px"
            width="80px"
            height="13px"
          />
        </StyledTableCell>
        <StyledTableCell width="10%">
          <LabelZeroData
            borderRadius="10px"
            width="80px"
            height="13px"
          />
        </StyledTableCell>
        <StyledTableCell width="5%">
          <ChevronDown color={darkBlue} />
        </StyledTableCell>
      </StyledTableRow>
    ));
  };

  const renderStatusRow = (incident, now) => {
    const { darkBlue } = theme.palette.text;
    const { navDark } = theme.palette.background;
    if (incident.componentsIds && incident.componentsIds[0]
      && incident.componentsIds[0].startsWith('RosDiag:')) {
      return null; // HACK(herchu) Skip these; too many errors otherwise
    }
    const id = incident._id;
    const isSelected = selectedIncident == id;
    const robotName = (robotsMap?.[incident.robotId]?.name) || '';
    const componentName = ((incident.latestEvent && incident.latestEvent.name)
      || (incident.componentsIds && incident.componentsIds[0]));
    const data = (incident.latestEvent
      && (incident.latestEvent.formattedValue || incident.latestEvent.attributeValue))
      || '';
    if (!incident._timestampStr) {
      const durationSecs = Math.floor(
        ((incident.resolvedAt || Date.now()) - incident.createdAt) / 1000
      );
      const { str: durationStr } = formatDuration(durationSecs, 's');
      incident._durationStr = durationStr;
      // cache formatted timestamps; they are expensive to build too
      incident._timestampStr = '~' + moment(incident.resolvedAt || incident.updatedAt || incident.createdAt).from(now);
    }
    const isResolved = incident.status != INCIDENT_STATUS_NEW;
    const line = [(
      <StyledTableRow
        key={id}
        data-id={id}
        title={getIncidentMessage(incident)}
        onClick={getTableRowClickHandler(id)}
        selected={isSelected}
        className={classnames({ [classes.selectedRow]: isSelected })}
        style={{ cursor: 'pointer' }}
      >
        <StyledTableCell width='10%'>
          <div
            className={classes.severityBadge}
            style={{
              backgroundColor: theme.palette.severityColor[incident.highestSeverity || ICM_SEV_2],
              // Black or white, whichever contrasts the chip color in the active theme
              color: theme.palette.getContrastText(
                theme.palette.severityColor[incident.highestSeverity || ICM_SEV_2]
              ),
            }}
          >
            {incident.highestSeverity || ICM_SEV_2}
          </div>
        </StyledTableCell>
        <StyledTableCell
          width='15%'
          className={
            classnames(
              classes.solvedTypography,
              { [classes.notSolvedTypography]: !isResolved }
            )
          }
        >
          {incident.status == INCIDENT_STATUS_NEW ? (
            <div className={classes.iconContainer}>
              <CircleDot size={16} color={theme.palette.incidents.error} />
              &nbsp;Open
            </div>
          ) : (
            <div className={classes.iconContainer}>
              <CircleCheckBig size={16} color={theme.palette.incidents.resolved} />
              &nbsp;Resolved
            </div>
          )}
        </StyledTableCell>
        <StyledTableCell
          width='20%'
          className={
            classnames(
              classes.solvedTypography,
              { [classes.notSolvedTypography]: !isResolved }
            )
          }
        >
          {incident._timestampStr}
        </StyledTableCell>
        <StyledTableCell
          width='20%'
          className={
            classnames(
              classes.solvedTypography,
              { [classes.notSolvedTypography]: !isResolved }
            )
          }
        >
          {robotName}
        </StyledTableCell>
        <StyledTableCell
          width='20%'
          className={
            classnames(
              classes.solvedTypography,
              { [classes.notSolvedTypography]: !isResolved }
            )
          }
        >
          {componentName}
        </StyledTableCell>
        <StyledTableCell
          width='10%'
          className={
            classnames(
              classes.solvedTypography,
              { [classes.notSolvedTypography]: !isResolved }
            )
          }
        >
          {data}
        </StyledTableCell>
        <StyledTableCell width='5%'>
          <ChevronDown color={darkBlue} />
        </StyledTableCell>
      </StyledTableRow>
    )];
    if (isSelected) {
      if (!incident._firstDetectedStr) {
        const formattedClosedInterval = formatTimeInterval(incident.createdAt, incident.resolvedAt);
        incident._firstDetectedStr = formattedClosedInterval.start;
        // incident._resolvedStr can be null if still open
        incident._resolvedStr = incident.resolvedAt && formattedClosedInterval.end;
        if (incident.updatedAt) {
          const formattedOpenInterval = formatTimeInterval(incident.createdAt, incident.updatedAt);
          incident._lastDetectedStr = formattedOpenInterval.end;
        } else {
          incident._lastDetectedStr = undefined;
        }
      }
      line.push(
        <StyledTableRow
          key={id + '-expanded'}
          title={getIncidentMessage(incident)}
          selected={isSelected}
          className={classnames({ [classes.selectedRow]: isSelected })}
        >
          <StyledTableCell colSpan={7} style={{ width: 'auto', backgroundColor: navDark }}>
            <ul>
              <li>
                Message: {getIncidentMessage(incident)}
              </li>
              <li>
                Severity / Highest Severity: {incident.severity} / {incident.highestSeverity}
              </li>
              <li>
                Triggered at: {incident._firstDetectedStr} for {incident._durationStr}
              </li>
              {incident._lastDetectedStr && (
                <li>
                  Last detected at {incident._lastDetectedStr}
                </li>
              )}
              {incident._resolvedStr && (
                <li>
                  Cleared at {incident._resolvedStr}
                </li>
              )}
            </ul>
          </StyledTableCell>
          <StyledTableCell>
            {''}
          </StyledTableCell>
        </StyledTableRow>
      );
    }
    return line;
  };

  const t0 = Date.now(); // eslint-disable-line no-unused-vars
  const direction = sortAsc ? 'asc' : 'desc'; // for MUI's TableSortLabel
  const now = Date.now();
  const incidentRows = sortedRows || [];
  return (
    <StyledTableContainer>
        <Table
          stickyHeader
          elementtype="table"
          aria-label="sticky table"
          size="small"
        >
          <TableHead>
            <StyledTableRow>
              <StyledTableCell
                width="10%"
              >
                <TableSortLabel
                  active={sortBy == SORT_SEV}
                  direction={direction}
                  hideSortIcon={isZeroData}
                  onClick={handleSortBySeverity}
                  classes={{
                    icon: classes.arrowIcon,
                    root: classnames({ [classes.cursorInactive]: isZeroData })
                  }}
                >
                  Severity
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell
                width="15%"
              >
                <TableSortLabel
                  active={sortBy == SORT_STATUS}
                  hideSortIcon={isZeroData}
                  direction={direction}
                  onClick={handleSortByStatus}
                  classes={{
                    icon: classes.arrowIcon,
                    root: classnames({ [classes.cursorInactive]: isZeroData })
                  }}
                >
                  Status
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell width='20%'>
                <TableSortLabel
                  active={sortBy == SORT_TIME}
                  hideSortIcon={isZeroData}
                  direction={direction}
                  onClick={handleSortByTime}
                  classes={{
                    icon: classes.arrowIcon,
                    root: classnames({ [classes.cursorInactive]: isZeroData })
                  }}
                >
                  Time
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell width="20%">
                <TableSortLabel
                  active={sortBy == SORT_ROBOT}
                  hideSortIcon={isZeroData}
                  direction={direction}
                  onClick={handleSortByRobot}
                  classes={{
                    icon: classes.arrowIcon,
                    root: classnames({ [classes.cursorInactive]: isZeroData })
                  }}
                >
                  Robot
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell width="20%">
                <TableSortLabel
                  active={sortBy == SORT_COMP}
                  hideSortIcon={isZeroData}
                  direction={direction}
                  onClick={handleSortByComponent}
                  classes={{
                    icon: classes.arrowIcon,
                    root: classnames({ [classes.cursorInactive]: isZeroData })
                  }}
                >
                  Component
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell width="10%">
                Data
              </StyledTableCell>
              <StyledTableCell width="5%">
              </StyledTableCell>
            </StyledTableRow>
          </TableHead>
          <StyledTableBody ref={tableRef}>
            {/* HACK(herchu) render at most rows (the first 200 in selected order) */}
            {incidentRows.map((st, ix) => ix < 150 && renderStatusRow(st, now))}
            {isZeroData && (renderZeroData())}
            {incidentRows.length == 0 && !isZeroData && (
              <StyledTableRow>
                <StyledTableCell colSpan="10" style={{ border: 'none' }}>
                  <NoDataIcon />
                </StyledTableCell>
              </StyledTableRow>
            )}
          </StyledTableBody>
          <TableFooter className={classes.footer}>
            {/* TODO Clara: uncomment the message when the BE limitation for incidents is ready */}
            {/* {timeLimitation && this.renderLimitErrorLine()} */}
          </TableFooter>
        </Table>
      </StyledTableContainer>
    );
};

IncidentListWidget.propTypes = {
  classes: PropTypes.object,
  theme: PropTypes.object,
  incidents: PropTypes.array,
  robotsMap: PropTypes.object,
  selectedIncident: PropTypes.string,
  selectStartTimeCallback: PropTypes.func,
  selectTimeRangeMsCallback: PropTypes.func,
  onTimeFocusChange: PropTypes.func,
  switchTo: PropTypes.func.isRequired,
  selectRobotCallback: PropTypes.func,
  onSelectedIncidentChange: PropTypes.func,
  isZeroData: PropTypes.bool,
};

export default legacyWithStyles(IncidentListWidget, styles);
