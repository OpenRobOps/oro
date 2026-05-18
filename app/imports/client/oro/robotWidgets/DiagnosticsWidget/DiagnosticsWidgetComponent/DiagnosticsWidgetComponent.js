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
 * Displays detailed ROS Diagnostics information divided in errors, warnings, stale and all.

  The expected props are an object with the following format:

  diagnostics: {
    ts: timestamp,
    list: [{
      "name": "/AnalyzerGroup",
      "level": 2,
      "message": "No analyzers"
    }, {
      "name": "/Other",
      "level": 2,
      "message": "Error"
    }, {
      "name": "/Other/Battery Status",
      "level": 0,
      "message": "don't charge.",
      "keyValues": {
        "Voltage (V)": "14.4",
        "Percent": "39.55"
      }
    }, {
      "name": "/Other/EtherCAT Master",
      "level": 1,
      "message": "Slow speed."
    }, {
      "name": "/Other/Power board 1000",
      "level": 0,
      "message": "Running."
    }, {
      "name": "/Other/Proximity sensor Status",
      "level": 3,
      "message": "Delay to measure."
    }, {
      "name": "/Other/WIFI Status",
      "level": 2,
      "message": "Connection lost."
    }]
  }

// TODO Display when the whole data is old somehow
// (i.e.: agent disconnected, no new data points since X time ...)
// TODO Automatically display "ALL" tab by default
// if there aren't any errors or warnings
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  TableHead,
  IconButton
} from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import { makeStyles } from 'tss-react/mui';
import { isEmpty } from 'lodash';
// ORO modules
import DiagnosticsEntry, { DIAG_VALUES } from './DiagnosticsEntry';
import { StyledTableBody, StyledTableCell, StyledTableContainer, StyledTableRow } from '../../../util/DefaultTable';
import NoDataIcon from '../../../graphics/op/NoDataIcon';

const useStyles = makeStyles()(() => ({
  inactiveIcon: {
    height: '18px',
    paddingRight: '4px',
    verticalAlign: 'middle'
  },
  arrowIcon: {
    padding: '0px',
    fontSize: '1rem'
  }
}));

// These constants correspond to the values in DIAG_VALUES_BUTTONS
const LEVEL_ALL = 'ALL';
const LEVEL_ERROR = 'ERROR';
const LEVEL_WARNING = 'WARNING';
const LEVEL_STALE = 'STALE';

// Maximum data age to show in diagnostics display, in milliseconds
const MAX_DATA_AGE = 5 * 60 * 1000;

// Fixed updateStamp for robots in the ghost fleet.
const GHOST_FLEET_UPDATE_TS = 12;

const DiagnosticsWidget = ({
  diagnostics,
  selectedRosDiagnosticsLevel,
  offline,
  nowTs
}) => {
  const { classes } = useStyles();
  const [currentNodeName, setCurrentNodeName] = useState('');
  const [expandedNodeName, setExpandedNodeName] = useState('');
  // Whenever the selected level changes, reset the selected node to the tree root
  useEffect(() => {
    if (selectedRosDiagnosticsLevel != LEVEL_ALL) {
      setCurrentNodeName('');
    }
  }, [selectedRosDiagnosticsLevel]);

  // Build a complete list of nodes in diagnostics tree, including nodes implicitly named by
  // leaf nodes (e.g. "/Sensors/Battery" without a "/Sensors")
  const parsedNodes = useMemo(() => {
    // First make sure data is sorted (good for display and requirement to build the tree below)
    let sortedData;
    if (diagnostics && Array.isArray(diagnostics.statusList)) {
      sortedData = diagnostics.statusList.sort((a, b) => {
        const nameA = (a && a.name) || '';
        const nameB = (b && b.name) || '';
        return nameA.localeCompare(nameB);
      });
    } else {
      sortedData = [];
    }
    const treeNodes = [];
    const nodesSeenByName = {};
    sortedData.forEach((node) => {
      // Sanitize name
      let name = (node.name || '');
      if (name[0] != '/') { // make sure all names start with '/'
        name = '/' + name;
      }
      const parts = name.split('/');
      // Iterate over this nodes' ancestors to make sure these all exist.
      // For example if node '/Sensors/Battery/1' exists, create '/Sensors' and '/Sensors/Battery'
      // After this loop, `ancestorName` will always be the name of the (existing) parent node
      let previousAncestorName = null;
      let ancestorName;
      for (let ix = 0; ix < parts.length - 1; ix++) {
        ancestorName = ix == 0 ? '' : `${ancestorName}/${parts[ix]}`;
        if (!nodesSeenByName[ancestorName]) {
          // This ancestor node does not exist; create one 'fake' diagnostics node
          const newNode = {
            name: ancestorName,
            fake: true, // flag to indicate it's not part of the original data
            parentName: previousAncestorName,
            children: []
          };
          if (ancestorName) { // add new ancestors under their parent (except if this is root node)
            nodesSeenByName[previousAncestorName].children.push(newNode);
          }
          treeNodes.push(newNode);
          nodesSeenByName[ancestorName] = newNode;
        }
        previousAncestorName = ancestorName;
      }
      // Create new node element (same as the diagnostics element plus tree links)
      const parsedNode = {
        ...node, // level, name, etc.
        parentName: ancestorName,
        children: [],
      };
      // Add this node as children
      nodesSeenByName[ancestorName].children.push(parsedNode);
      // Append this node to all tree nodes
      treeNodes.push(parsedNode);
      nodesSeenByName[name] = parsedNode;
    });
    return treeNodes;
  }, [diagnostics]);

  // Determine which nodes to display (based on nodes parsed as a tree, and current node name)
  const [currentNode, displayNodes] = useMemo(() => {
    switch (selectedRosDiagnosticsLevel) {
      case LEVEL_ERROR:
        // Show only errors
        return [null, parsedNodes.filter(d => d.level == DIAG_VALUES.ERROR)];
      case LEVEL_WARNING:
        // Show only warnings
        return [null, parsedNodes.filter(d => d.level == DIAG_VALUES.WARN)];
      case LEVEL_STALE:
        // Show only stale
        return [null, parsedNodes.filter(d => d.level == DIAG_VALUES.STALE)];
      default: // including LEVEL_ALL
        const parent = parsedNodes.find(n => n.name == currentNodeName) || parsedNodes[0];
        return [parent, (parent && parent.children) || []];
    }
  }, [diagnostics, parsedNodes, currentNodeName, selectedRosDiagnosticsLevel]);

  const isActive = useMemo(() => {
    // Returns true when we are in Time Capsule mode or
    // if we are in live mode, the robot is online and we have non-stale diagnostics
    if (!offline && diagnostics && diagnostics.ts) {
      const diagTsMs = Number.parseInt(diagnostics.ts, 10);
      // NOTE: this is a temporary hack to display diagnostics for
      // the ghost fleet, which doesn't update its timestamp.
      if (diagTsMs == GHOST_FLEET_UPDATE_TS) {
        return true;
      }
      // For live mode, use nowTs as reference time and check if data is stale
      // Discard data older than MAX_DATA_AGE
      if (nowTs - diagTsMs > MAX_DATA_AGE) {
        return false;
      }
      return true;
    } else {
      return false;
    }
  }, [offline, diagnostics, nowTs]);

  const handleNodeExpand = useCallback((nodeName) => {
    setExpandedNodeName(expandedNodeName === nodeName ? '' : nodeName);
  }, [expandedNodeName]);

  const handleNodeClick = useCallback((nodeName) => {
    setExpandedNodeName('');
    setCurrentNodeName(nodeName);
  }, []);

  const handleParentClick = useCallback(() => {
    setCurrentNodeName(currentNode.parentName);
  }, [currentNode]);

  return (
    <StyledTableContainer>
      <Table
        element="table"
        aria-label="sticky table"
        stickyHeader
        size="small"
        style={{ height: '10%' }}
      >
        <TableHead>
          <StyledTableRow>
            <StyledTableCell width="10%">
              <IconButton
                onClick={handleParentClick}
                disabled={(selectedRosDiagnosticsLevel && selectedRosDiagnosticsLevel != LEVEL_ALL) || !currentNodeName}
                size="small"
                className={classes.arrowIcon}
              >
                <KeyboardArrowLeftIcon className={classes.arrowIcon} />
              </IconButton>
            </StyledTableCell>
            <StyledTableCell width="40%">
              {currentNodeName || 'Name'}
            </StyledTableCell>
            <StyledTableCell width="40%">
              {!isActive && (
                <AlarmOffIcon className={classes.inactiveIcon} />
              )}
              Message
            </StyledTableCell>
            <StyledTableCell width="10%" />
          </StyledTableRow>
        </TableHead>
        <StyledTableBody>
          {displayNodes.length ? (
            displayNodes.map(s => (
              <DiagnosticsEntry
                level={s.level}
                key={s.name}
                name={s.name}
                message={s.msg}
                keyValues={s.keyValues}
                isActive={isActive}
                onClick={
                  s.children.length ? handleNodeClick : undefined
                }
                onExpand={s.children.length === 0 && !isEmpty(s.keyValues) ? handleNodeExpand : null}
                expanded={expandedNodeName === s.name}
              />
            ))
          ) : (
            <StyledTableRow>
              <StyledTableCell colSpan="4">
                  <NoDataIcon />
              </StyledTableCell>
            </StyledTableRow>
          )}
        </StyledTableBody>
      </Table>
    </StyledTableContainer>
  );
};

DiagnosticsWidget.propTypes = {
  diagnostics: PropTypes.object,
  selectedRosDiagnosticsLevel: PropTypes.string,
  offline: PropTypes.bool,
  nowTs: PropTypes.number
};

export {
  LEVEL_ALL,
  LEVEL_ERROR,
  LEVEL_WARNING,
  LEVEL_STALE
};

export default DiagnosticsWidget;
