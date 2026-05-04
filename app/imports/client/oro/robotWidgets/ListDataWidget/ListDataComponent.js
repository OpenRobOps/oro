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
 * List Data Widget Component independent of Meteor
 *  - Renders a table widget that allows to display text and number attributeValues
 *  - attributeValues are received as props
 */
import React, { useMemo } from 'react';
import { isEmpty } from 'lodash';
import { Table, TableHead } from '@mui/material';
import PropTypes from 'prop-types';
// ORO modules
import TableCellAttributeValue from './TableCellAttributeValue';
import { StyledTableBody, StyledTableCell, StyledTableContainer, StyledTableRow } from '../../util/DefaultTable';
import NoDataIcon from '../../graphics/op/NoDataIcon';

const EMPTY_OBJECT = {};

const ListDataComponent = ({
  attributeValues = EMPTY_OBJECT,
  config = EMPTY_OBJECT,
  nowTs,
  isLoading
}) => {
  const { elementList = [], elementValues = EMPTY_OBJECT } = config;
  const dataSources = useMemo(() => (
    elementList.map(attrId => ({ id: attrId, ...elementValues[attrId] })).filter(Boolean)
  ), [elementList, elementValues]);
  
  return (
    <StyledTableContainer>
      <Table stickyHeader aria-label="sticky table" size="small">
        <TableHead>
          <StyledTableRow>
            <StyledTableCell width="35%">
              Data source
            </StyledTableCell>
            <StyledTableCell width="65%">
              Value
            </StyledTableCell>
          </StyledTableRow>
        </TableHead>
        <StyledTableBody>
          {isEmpty(dataSources) || isLoading
            ? <NoDataIcon />
            : dataSources.map((attributeDefinition) => {
              const { label = '' } = attributeDefinition || {};
              return (
                <StyledTableRow key={attributeDefinition.id}>
                  <StyledTableCell width="35%">
                    {label}
                  </StyledTableCell>
                 <TableCellAttributeValue
                    attributeId={attributeDefinition.id}
                    attributeValue={attributeValues?.[attributeDefinition.id]}
                    attributeDefinition={attributeDefinition}
                    nowTs={nowTs}
                  />
                </StyledTableRow>
              );
            })}
        </StyledTableBody>
      </Table>
    </StyledTableContainer>
  );
};

ListDataComponent.propTypes = {
  attributeValues: PropTypes.object,
  config: PropTypes.object,
  nowTs: PropTypes.number,
  isLoading: PropTypes.bool
};

export default ListDataComponent;
