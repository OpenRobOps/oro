/**
 * Styled table components for widget tables.
 *
 * Uses normal table layout with stickyHeader on <Table> for fixed headers.
 * The container handles overflow/scrolling, keeping columns naturally aligned.
 *
 *!Important: The Table Component that's imported of MUI should have as
 *            property stickyHeader to make the header fixed at the top
 *            (not scrolling), and size: 'small' to have the same padding on all the cells
 */

import { styled } from '@mui/material/styles';
import {
  TableRow,
  TableBody,
  TableCell,
} from '@mui/material';
import TableContainer from '@mui/material/TableContainer';

/**
 * Styled table container — handles max-height and scroll.
 * The stickyHeader prop on <Table> keeps the header fixed.
 */
const StyledTableContainer = styled(TableContainer, { name: 'StyledTableContainer' })({
  '&.MuiTableContainer-root': {
    maxHeight: '100%',
    overflowY: 'auto',
  },
  '& .MuiTable-root': {
    tableLayout: 'fixed',
    width: '100%',
  },
});

/**
 * Styled table body — no display hacks, just standard table-row-group.
 */
const StyledTableBody = styled(TableBody, { name: 'StyledTableBody' })({});

/**
 * Styled table cell.
 * Width is '20%' by default, override per widget with the width prop.
 */
const StyledTableCell = styled(TableCell, { name: 'StyledTableCell' })(({ theme, width }) => ({
  '&.MuiTableCell-root': {
    width: width || '20%',
    fontSize: '13px',
    padding: '7px 10px',
    wordBreak: 'break-word',
    borderBottom: '1px solid #3E3155',
  },
  '&.MuiTableCell-stickyHeader': {
    backgroundColor: '#170E28',
    fontWeight: 501,
    color: theme.palette.text.title,
    borderBottom: '2px solid #3E3155'
  }
}));

/**
 * Styled table row — standard table layout, no display overrides.
 */
const StyledTableRow = styled(TableRow, { name: 'StyledTableRow' })({});

export {
  StyledTableContainer,
  StyledTableBody,
  StyledTableCell,
  StyledTableRow
};
