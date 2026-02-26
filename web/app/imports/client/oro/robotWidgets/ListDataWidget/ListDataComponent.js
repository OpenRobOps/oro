/**
 * List Data Widget Component independent of Meteor
 *  - Renders a table widget that allows to display text and number attributeValues
 *  - attributeValues are received as props
 */
import React from 'react';
import { isEmpty } from 'lodash';
import { Table, TableHead } from '@mui/material';
import PropTypes from 'prop-types';
// ORO modules
import TableCellAttributeValue from './TableCellAttributeValue';
import { StyledTableBody, StyledTableCell, StyledTableContainer, StyledTableRow } from '../../util/DefaultTable';
import NoDataIcon from '../../graphics/op/NoDataIcon';

const ListDataComponent = ({
  attributeValues = {},
  config = {},
  nowTs,
  isLoading
}) => {
  const { dataSources = [] } = config;

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
                    attributeValues={attributeValues}
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
