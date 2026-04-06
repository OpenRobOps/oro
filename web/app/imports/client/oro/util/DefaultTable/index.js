/**
 * Table components for widget tables.
 *
 * Thin wrappers over plain MUI Table components with oro theme colors.
 * Keeps the same export names so consumers don't need changes.
 *
 *!Important: The Table Component that's imported of MUI should have as
 *            property stickyHeader to make the header fixed at the top
 *            (not scrolling), and size: 'small' to have the same padding on all the cells
 */

import {
  TableRow,
  TableBody,
  TableCell,
  TableContainer,
} from '@mui/material';

const StyledTableContainer = (props) => (
  <TableContainer
    {...props}
    sx={{
      maxHeight: '100%',
      overflowY: 'auto',
      '& .MuiTable-root': {
        tableLayout: 'fixed',
        width: '100%',
      },
      ...props.sx,
    }}
  />
);

const StyledTableBody = TableBody;

const StyledTableCell = ({ width, sx, ...props }) => (
  <TableCell
    {...props}
    sx={(theme) => ({
      width: width || '20%',
      fontSize: '13px',
      padding: '7px 10px',
      wordBreak: 'break-word',
      borderBottom: `1px solid ${theme.palette.background.borderLight}`,
      '&.MuiTableCell-stickyHeader': {
        backgroundColor: theme.palette.background.surface,
        fontWeight: 501,
        color: theme.palette.text.title,
        borderBottom: `1px solid ${theme.palette.background.borderLight}`,
      },
      ...(typeof sx === 'function' ? sx(theme) : sx),
    })}
  />
);

const StyledTableRow = TableRow;

export {
  StyledTableContainer,
  StyledTableBody,
  StyledTableCell,
  StyledTableRow
};
