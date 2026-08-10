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
 * FleetControlWidgetOptionsComponent - Expanded options panel for the FleetControlWidget.
 * Shows: filter by status pills + filter by components selector + sort by selector.
 */
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { Typography } from '@mui/material';
import { Cancel, FiberManualRecordRounded } from '@mui/icons-material';
import SortByComponent from './SortByComponent';
import FilterByComponentSelector from './FilterByComponentSelector';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  FLAG_ERROR, FLAG_WARNING, FLAG_OK, FLAG_OFFLINE,
  DEFAULT_FLAGS_STRING, isInRobotStatusString, makeAttributeStatusUrlParam,
} from '../../fleetFilteringUtil';
import { STATUS, getStatusColor } from '../../../../../lib/status';

const STATUS_PILLS = [
  { flag: FLAG_ERROR, label: 'Error', shortLabel: 'Err' },
  { flag: FLAG_WARNING, label: 'Warning', shortLabel: 'Wrn' },
  { flag: FLAG_OK, label: 'OK', shortLabel: 'OK' },
  { flag: FLAG_OFFLINE, label: 'Offline', shortLabel: 'Off' },
];

const noFilterItem = { label: 'No Filter', value: null };
const makeMenuItem = (label, value, icon) => ({ label, value, icon });

const useStyles = makeStyles()(theme => ({
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 5,
  },
  optionsPanel: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    background: theme.palette.background.surface,
    borderTop: `1px solid ${theme.palette.background.borderLight}`,
    borderBottomLeftRadius: '10px',
    borderBottomRightRadius: '10px',
    padding: '10px',
    display: 'flex',
    gap: '10px',
    boxSizing: 'border-box',
  },
  section: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  sectionLabel: {
    fontFamily: theme.fontFamily.mono,
    fontSize: '11px',
    fontWeight: 400,
    color: theme.palette.text.buttonText,
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
  },
  pillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'center',
    minHeight: '24px',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '24px',
    padding: '0 7px',
    borderRadius: '4px',
    border: `1px solid ${theme.palette.background.borderGray}`,
    cursor: 'pointer',
    flexShrink: 0,
    background: theme.palette.background.black,
    userSelect: 'none',
  },
  pillSelected: {
    background: theme.palette.background.borderLight,
  },
  dot: {
    width: '5.5px',
    height: '5.5px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  pillLabel: {
    fontSize: '12px',
    fontWeight: 400,
    fontFamily: theme.fontFamily.ui,
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
    color: theme.palette.text.inactive,
  },
  pillLabelSelected: {
    color: theme.palette.text.buttonText,
  },
  pillCancelIcon: {
    fontSize: '12px !important',
    color: theme.palette.text.buttonText,
    flexShrink: 0,
  },
}));

/**
 * StatusPill: a single toggleable filter pill for the status filter row.
 * Extracted as a component so its event handlers are stable (not recreated per render).
 */
const StatusPill = ({ flag, label, dotColor, isSelected, onToggle, classes, cx }) => {
  const handleClick = useCallback(() => onToggle(flag), [onToggle, flag]);
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') onToggle(flag);
  }, [onToggle, flag]);

  return (
    <div
      className={cx(classes.pill, { [classes.pillSelected]: isSelected })}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className={classes.dot} style={{ backgroundColor: dotColor }} />
      <Typography className={cx(classes.pillLabel, { [classes.pillLabelSelected]: isSelected })}>
        {label}
      </Typography>
      {isSelected && <Cancel className={classes.pillCancelIcon} />}
    </div>
  );
};

StatusPill.propTypes = {
  flag: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  dotColor: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  cx: PropTypes.func.isRequired,
};

const FleetControlWidgetOptionsComponent = ({
  onClose,
  sortBy,
  onSortBySelected,
  robotStatus,
  onRobotStatusSelected,
  attributeStatus,
  onAttributeStatusSelected,
  config,
}) => {
  const { classes, cx, theme } = useStyles();
  const statusList = config?.elementList || [];
  const statusValues = config?.elementValues || {};
  const isMobile = useMediaQuery('(max-width:1200px)');

  const dotColors = useMemo(() => ({
    [FLAG_ERROR]: theme.palette.incidents.error,
    [FLAG_WARNING]: theme.palette.incidents.warning,
    [FLAG_OK]: theme.palette.incidents.ok,
    [FLAG_OFFLINE]: theme.palette.text.inactive,
  }), []);  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStatus = useCallback((flag) => {
    const current = robotStatus || DEFAULT_FLAGS_STRING;
    const modified = isInRobotStatusString(flag, current)
      ? current.replace(flag, '') || null
      : current + flag;
    onRobotStatusSelected(modified);
  }, [robotStatus, onRobotStatusSelected]);

  // Build autocomplete options: noFilterItem + (error/warn/ok) × component
  const statusMenuOptions = useMemo(() => {
    const items = [];
    if (statusList.length && statusValues) {
      statusList.forEach((statusId) => {
        const status = statusValues[statusId];
        if (!status) return;
        const { label } = status;
        items.push(makeMenuItem(
          label,
          makeAttributeStatusUrlParam(statusId, STATUS.ERROR.value),
          <FiberManualRecordRounded style={{ color: getStatusColor(STATUS.ERROR, true, theme), fontSize: 16 }} />,
        ));
        items.push(makeMenuItem(
          label,
          makeAttributeStatusUrlParam(statusId, STATUS.WARN.value),
          <FiberManualRecordRounded style={{ color: getStatusColor(STATUS.WARN, true, theme), fontSize: 16 }} />,
        ));
        items.push(makeMenuItem(
          label,
          makeAttributeStatusUrlParam(statusId, STATUS.OK.value),
          <FiberManualRecordRounded style={{ color: getStatusColor(STATUS.OK, true, theme), fontSize: 16 }} />,
        ));
      });
    }
    return [noFilterItem, ...items];
  }, [statusList, statusValues]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Find the selected option object that matches current attributeStatus
  const selectedAttributeStatusObj = useMemo(() => {
    if (!attributeStatus) {
      return noFilterItem;
    }
    const str = JSON.stringify(attributeStatus);
    return statusMenuOptions.find(item => JSON.stringify(item.value) === str) || noFilterItem;
  }, [statusMenuOptions, attributeStatus]);

  const handleAttrFilterChange = useCallback((option) => {
    onAttributeStatusSelected(option?.value || null);
  }, [onAttributeStatusSelected]);

  return [
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div key="modal-backdrop" className={classes.modalBackdrop} onClick={onClose} />,
    <div key="options-panel" className={classes.optionsPanel}>
      {/* Filter by status */}
      <div className={classes.section}>
        <Typography className={classes.sectionLabel}>Filter by status</Typography>
        <div className={classes.pillsRow}>
          {STATUS_PILLS.map(({ flag, label, shortLabel }) => (
            <StatusPill
              key={flag}
              flag={flag}
              label={isMobile ? shortLabel : label}
              dotColor={dotColors[flag]}
              isSelected={isInRobotStatusString(flag, robotStatus)}
              onToggle={toggleStatus}
              classes={classes}
              cx={cx}
            />
          ))}
        </div>
      </div>
      {/* Filter by components */}
      {statusList.length > 0 && (
        <div className={classes.section}>
          <Typography className={classes.sectionLabel}>Filter by components</Typography>
          <FilterByComponentSelector
            options={statusMenuOptions}
            value={selectedAttributeStatusObj}
            onChange={handleAttrFilterChange}
          />
        </div>
      )}
      {/* Sort by */}
      <div className={classes.section}>
        <Typography className={classes.sectionLabel}>Sort by</Typography>
        <SortByComponent
          sortBy={sortBy}
          onSortBySelected={onSortBySelected}
        />
      </div>

    </div>
  ];
};

FleetControlWidgetOptionsComponent.propTypes = {
  onClose: PropTypes.func.isRequired,
  sortBy: PropTypes.string,
  onSortBySelected: PropTypes.func.isRequired,
  robotStatus: PropTypes.string,
  onRobotStatusSelected: PropTypes.func.isRequired,
  attributeStatus: PropTypes.object,
  onAttributeStatusSelected: PropTypes.func,
  config: PropTypes.object,
};

export default FleetControlWidgetOptionsComponent;
