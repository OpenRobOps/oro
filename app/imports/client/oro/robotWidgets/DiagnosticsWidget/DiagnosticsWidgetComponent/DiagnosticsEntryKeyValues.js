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
 * Component to render a table with key-value pairs.
 */
import React from 'react';
import { Table, TableHead, TableBody } from '@mui/material';
import PropTypes from 'prop-types';
// ORO modules
import { StyledTableCell, StyledTableRow, StyledTableContainer } from '../../../util/DefaultTable';

/**
 * Renders a table with key-value pairs.
 */
const DiagnosticsKeyValues = ({ keyValues }) => (
  <StyledTableContainer>
    <Table stickyHeader element="table" aria-label="sticky table" size="small">
      <TableHead>
        <StyledTableRow>
          <StyledTableCell width="35%">
            Key
          </StyledTableCell>
          <StyledTableCell width="65%">
            Value
          </StyledTableCell>
        </StyledTableRow>
      </TableHead>
      <TableBody>
        {Object.keys(keyValues).map(key => (
          <StyledTableRow key={key}>
            <StyledTableCell width="35%">
              {key}
            </StyledTableCell>
            <StyledTableCell width="65%">
              {keyValues[key]}
            </StyledTableCell>
          </StyledTableRow>
        ))}
      </TableBody>
    </Table>
  </StyledTableContainer>
);

DiagnosticsKeyValues.propTypes = {
  keyValues: PropTypes.object.isRequired
};

export default DiagnosticsKeyValues;
