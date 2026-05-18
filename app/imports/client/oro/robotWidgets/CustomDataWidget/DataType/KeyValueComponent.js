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
 * Key-Value Component
 * displays key-value pairs
 * Used by:
 *  - Key-value widget (Custom Data widget)
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { isEmpty, sortBy, isArray } from 'lodash';
import moment from 'moment';
import classNames from 'classnames';
import { Table, TableHead, TableSortLabel } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { AttributeValueFormatter } from '../../../../../shared/attributes';
import { UNDEFINED_VALUE } from '../../../../../lib/util';
import {
  StyledTableBody,
  StyledTableCell,
  StyledTableContainer,
  StyledTableRow,
} from '../../../util/DefaultTable';
import NoDataIcon from '../../../graphics/op/NoDataIcon';

const MAX_DATA_AGE = 1000 * 60 * 5;
const KV_RECENT_TIME = moment.duration(1, 'minutes').valueOf();

const formatter = AttributeValueFormatter(null);

const useStyles = makeStyles()(theme => ({
  arrowIcon: {
    color: theme.palette.text.title,
    fontSize: '0.875rem',
  },
  staleValue: {
    color: theme.palette.incidents.inactive,
  },
  textValueUndefined: {
    padding: theme.spacing(1),
    verticalAlign: 'top',
    color: theme.palette.text.statusError,
  },
}));

const KeyValueComponent = ({ customData, staleIndicator = true, now }) => {
  const { classes } = useStyles();
  const [sortKey, setSortKey] = useState('key');
  const [sortAsc, setSortAsc] = useState(true);

  const sortedData = useMemo(() => {
    if (!isArray(customData) || isEmpty(customData)) return customData;
    const sorted = sortKey === 'ts' ? sortBy(customData, 'ts') : [...customData];
    return sortAsc ? sorted : [...sorted].reverse();
  }, [customData, sortKey, sortAsc]);

  const handleClickDataSource = () => {
    setSortKey('key');
    setSortAsc(prev => !prev);
  };

  const handleClickLastUpdate = () => {
    setSortKey('ts');
    setSortAsc(prev => !prev);
  };

  const direction = sortAsc ? 'asc' : 'desc';

  const rows = useMemo(() => {
    if (isEmpty(sortedData)) return (
      <StyledTableRow>
        <StyledTableCell colSpan="3" style={{ border: 'none' }}>
          <NoDataIcon />
        </StyledTableCell>
      </StyledTableRow>
    );
    return sortedData.map(kv => {
      let { ts } = kv;
      const value = kv.value !== undefined ? formatter(kv.value) : UNDEFINED_VALUE;
      // HACK: Timestamps may come a few secs/mins in the future due to clock differences.
      if (ts > now) ts = now;
      const isStale = staleIndicator && now - kv.ts > MAX_DATA_AGE;
      return (
        <StyledTableRow
          data-test="mc-keyvalue-widget-tablerow"
          key={kv.key}
          className={isStale ? classes.staleValue : null}
        >
          <StyledTableCell
            data-test="mc-keyvalue-widget-tablekey"
            width="30%"
            className={classNames({ [classes.textValueUndefined]: value === UNDEFINED_VALUE })}
          >
            {kv.key}
          </StyledTableCell>
          <StyledTableCell
            data-test="mc-keyvalue-widget-tablevalue"
            width="30%"
            className={classNames({ [classes.textValueUndefined]: value === UNDEFINED_VALUE })}
          >
            {value}
          </StyledTableCell>
          <StyledTableCell
            width="30%"
            className={classNames({ [classes.textValueUndefined]: value === UNDEFINED_VALUE })}
          >
            {ts > now - KV_RECENT_TIME ? 'recently' : moment(ts).from(now)}
          </StyledTableCell>
        </StyledTableRow>
      );
    });
  }, [sortedData, staleIndicator, now, classes]);

  return (
    <StyledTableContainer data-test="mc-keyvalue-widget">
      <Table stickyHeader element="table" aria-label="sticky table" size="small">
        <TableHead>
          <StyledTableRow>
            <StyledTableCell width="30%">
              <TableSortLabel
                onClick={handleClickDataSource}
                direction={direction}
                classes={{ icon: classes.arrowIcon }}
              >
                Data Source
              </TableSortLabel>
            </StyledTableCell>
            <StyledTableCell width="30%">Value</StyledTableCell>
            <StyledTableCell width="30%">
              <TableSortLabel
                onClick={handleClickLastUpdate}
                direction={direction}
                classes={{ icon: classes.arrowIcon }}
              >
                Last Update
              </TableSortLabel>
            </StyledTableCell>
          </StyledTableRow>
        </TableHead>
        <StyledTableBody>{rows}</StyledTableBody>
      </Table>
    </StyledTableContainer>
  );
};

KeyValueComponent.propTypes = {
  customData: PropTypes.array,
  staleIndicator: PropTypes.bool,
  now: PropTypes.number.isRequired,
};

export default KeyValueComponent;
