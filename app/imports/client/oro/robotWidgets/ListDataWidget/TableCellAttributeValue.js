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
 * AttributeValueCell Component
 * Returns Table Cell with the value of one attribute
 * if the value is a number it formats it and returns it with the unit
 * if the value is a text it returns it as plain text
 * it also adds a tooltip with the last time the agent published the attribute
 */
import React, { useMemo } from 'react';
import { isBoolean } from 'lodash';
import moment from 'moment';
import classnames from 'classnames';
import { RemoveCircle, CheckCircle } from '@mui/icons-material';
import { Tooltip, LinearProgress } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';
// ORO modules
import { AttributeValueFormatter } from '../../../../shared/attributes';
import { StyledTableCell } from '../../util/DefaultTable';

const useStyles = makeStyles()(theme => ({
  withProgressBar: {
    alignItems: 'center',
    width: 'auto'
  },
  progressBarContainer: {
    marginLeft: '10px',
    width: '75px',
    display: 'inline-block'
  },
  barColorPrimary: {
    backgroundColor: theme.palette.incidents.ok
  },
  barRoot: {
    height: '8px',
    borderRadius: '3px'
  },
  tableCellIcon: {
    verticalAlign: 'bottom',
    marginRight: '10px'
  },
  checkCircleIcon: {
    color: theme.palette.incidents.ok
  },
  removeCircleIcon: {
    color: theme.palette.incidents.error
  }
}));

const RECENT_TIME = moment.duration(1, 'minutes').valueOf();

/**
 * @param {string} attributeId - attribute key id to render information
 * @param {object} attributeValue - attribute value object
 * @param {number} nowTs - current timestamp
 */
const TableCellAttributeValue = ({ attributeId, attributeValue, attributeDefinition, nowTs }) => {
  const { classes } = useStyles();

  const formatter = useMemo(() => AttributeValueFormatter(attributeDefinition), [attributeDefinition]);
  const cellContent = formatter(attributeValue?.value) || '';

  let tooltipTs = '';
  let progressBarValue = '';
  let isBooleanAttribute = false;
  let valueIcon = false;

  if (attributeValue) {
    const ts = attributeValue.ts <= nowTs ? attributeValue.ts : nowTs;
    tooltipTs = ts > nowTs - RECENT_TIME ? 'recently' : moment(ts).from(nowTs);
    if (attributeDefinition?.unit === '%') {
      progressBarValue = attributeValue.value * 100;
    }
    if (isBoolean(attributeValue.value)) {
      isBooleanAttribute = true;
      valueIcon = attributeValue.value;
    }
  }

  return (
    <Tooltip title={tooltipTs} placement="top" disableInteractive>
      <StyledTableCell
        width="65%"
        className={classnames({ [classes.withProgressBar]: progressBarValue })}
      >
        {isBooleanAttribute && (
          valueIcon ? (
            <CheckCircle
              classes={{ root: classnames(classes.checkCircleIcon, classes.tableCellIcon) }}
            />
          ) : (
            <RemoveCircle
              classes={{ root: classnames(classes.removeCircleIcon, classes.tableCellIcon) }}
            />
          )
        )}
        {cellContent}
        {progressBarValue && (
          <div className={classes.progressBarContainer}>
            <LinearProgress
              variant="determinate"
              value={progressBarValue}
              classes={{
                barColorPrimary: classes.barColorPrimary,
                root: classes.barRoot
              }}
            />
          </div>
        )}
      </StyledTableCell>
    </Tooltip>
  );
};

TableCellAttributeValue.propTypes = {
  attributeId: PropTypes.string.isRequired,
  attributeValue: PropTypes.object.isRequired, // { value, ts}
  attributeDefinition: PropTypes.object.isRequired, // { label, unit, type, precision, scale }
  nowTs: PropTypes.number
};

export default TableCellAttributeValue;
