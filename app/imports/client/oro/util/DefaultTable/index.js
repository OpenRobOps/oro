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
 * Table components for widget tables.
 *
 * Thin wrappers over plain MUI Table components with ORO theme colors.
 * Keeps the same export names so consumers don't need changes.
 *
 *!Important: The Table Component that's imported of MUI should have as
 *            property stickyHeader to make the header fixed at the top
 *            (not scrolling), and size: 'small' to have the same padding on all the cells
 */

import React from 'react';
import {
  TableRow,
  TableBody,
  TableCell,
  TableContainer,
} from '@mui/material';

const StyledTableContainer = React.forwardRef(({ sx, ...props }, ref) => (
  <TableContainer
    ref={ref}
    {...props}
    sx={{
      maxHeight: '100%',
      overflowY: 'auto',
      '& .MuiTable-root': {
        tableLayout: 'fixed',
        width: '100%',
      },
      ...sx,
    }}
  />
));
StyledTableContainer.displayName = 'StyledTableContainer';

const StyledTableBody = TableBody;

const StyledTableCell = React.forwardRef(({ width, sx, ...props }, ref) => (
  <TableCell
    ref={ref}
    {...props}
    sx={(theme) => ({
      width: width || '20%',
      fontSize: '13px',
      padding: '7px 10px',
      wordBreak: 'break-word',
      borderBottom: `1px solid ${theme.palette.background.borderLight}`,
      // Table header cells (applies to every table built on StyledTableCell, sticky or not).
      '&.MuiTableCell-head': {
        color: theme.palette.text.primary,
        fontFamily: theme.fontFamily.ui,
        fontSize: '13px',
        fontStyle: 'normal',
        fontWeight: 500,
      },
      '&.MuiTableCell-stickyHeader': {
        backgroundColor: theme.palette.background.surface,
        borderBottom: `1px solid ${theme.palette.background.borderLight}`,
      },
      ...(typeof sx === 'function' ? sx(theme) : sx),
    })}
  />
));
StyledTableCell.displayName = 'StyledTableCell';

const StyledTableRow = TableRow;

export {
  StyledTableContainer,
  StyledTableBody,
  StyledTableCell,
  StyledTableRow
};
