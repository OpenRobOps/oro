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
 * Status Chip
 * Colored rectangular div that displays the status color for a given status.
 * Shows a tooltip with detailed status info on hover.
 */

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()(theme => ({
  chip: {
    minHeight: theme.spacing(1.5),
    margin: theme.spacing(0.75 / 2),
  },
}));

const StatusChip = ({
  statusColor,
  onTooltipMessage,
  robotId,
  attributeId,
}) => {
  const { classes } = useStyles();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState(null);

  useEffect(() => {
    setTooltipMessage(null);
  }, [onTooltipMessage]);

  const handleTooltipClose = useCallback(() => {
    setTooltipOpen(false);
  }, []);

  const handleTooltipOpen = useCallback(() => {
    if (onTooltipMessage) {
      onTooltipMessage({ robotId, attributeId }, (message) => {
        setTooltipMessage(message);
      });
      setTooltipOpen(true);
    }
  }, [onTooltipMessage, robotId, attributeId]);

  const div = (
    <div
      className={classes.chip}
      style={{ backgroundColor: statusColor }}
    />
  );

  if (tooltipMessage || onTooltipMessage) {
    return (
      <Tooltip
        title={tooltipMessage || ''}
        onClose={handleTooltipClose}
        onOpen={handleTooltipOpen}
        open={tooltipOpen && Boolean(tooltipMessage)}
        enterDelay={200}
        leaveDelay={200}
        disableInteractive
      >
        {div}
      </Tooltip>
    );
  }
  return div;
};

StatusChip.propTypes = {
  statusColor: PropTypes.string,
  onTooltipMessage: PropTypes.func,
  robotId: PropTypes.string,
  attributeId: PropTypes.string,
};

export default StatusChip;
