/**
 * These components are meant to be used in widgets that incorporate tables,
 * to make all tables to be the same and avoid repeating code every time they are defined.
 * Please take a look into https://docs.google.com/document/d/1oRwCqu5LFW4gjtGmW-i9vmVgh0fWOJEkKkT3Q-RAl3g/edit#heading=h.vovtmjfimjug
 * to see how this tables should be used.
 *
 * Exported components:
 * - Table Container:  is used in the same way as were using the grid container,
 *                     by using it we prevent the header from scrolling across the whole height
 *                     of the table when there are no or few rows.
 * - Table Body
 * - Table Row
 * - Table Cell
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
 * Exports a styled table container to contain all the table
 * prevents rows from escaping out of widget. This is used before
 * the Table component, replacing the Grid container component.
*/
const StyledTableContainer = styled(TableContainer, { name: 'StyledTableContainer' })({
  '&.MuiTableContainer-root': {
    maxHeight: '100%', // to prevent the table from moving out of the widget
    overflowY: 'hidden' // to avoid a double scrollbar on Y
  },
  '& .MuiTable-root': {
    // We should add a StyledTable component, but to avoid changing all code that currently
    // uses a plain MUI <Table>, we tune every Table inside a StyleTableContainer
    color: 'green',
    borderSpacing: 0,
    borderCollapse: 'collapse'
  }
});

/**
 * Exports a styled table body used to define the rows of the table that contain
 * data, in this case we are adding some styles to be able to show the scrollbarY
 * only on this component and not in the header.
*/
const StyledTableBody = styled(TableBody, { name: 'StyledTableBody' })({
  '&.MuiTableBody-root': {
    // To display the scrollbar only in the table body and not in the table header
    // the table body and not in the table header, for this we also define a height
    // (310px is the total of px height of the table without the px of the header).
    display: 'block',
    overflowY: 'scroll', // To avoid the table body to move when it has the scrollbar hidden and when not
    height: '310px', // the 40px we subtract here (as the widget content height is 350px by defualt)
    // is the height defined on the table cell header
    // (padding is by default given when adding to Table component: size = 'small')
  },
});

/**
 * Exports a styled table cell, to be used inside the table header and body.
 * !important:  The width is '20%' by default and it can be overriden in each widget,
 * depending on the specific's widget design for that cell's relative width,
 * this can be done with the prop:
 * width = "size"
 * MUI documentation https://mui.com/system/styled/
*/
const StyledTableCell = styled(TableCell, { name: 'StyledTableCell' })(({ theme, width }) => ({
  '&.MuiTableCell-root': {
    width: width || '20%',
    fontSize: '13px',
    padding: '7px 10px',
    wordBreak: 'break-word',
  },
  '&.MuiTableCell-stickyHeader': {
    /* by default MUI uses light grey as background color for the headers */
    backgroundColor: theme.palette.background.white,
    fontWeight: 501,
    color: theme.palette.text.title,
    borderBottom: `2px solid ${theme.palette.background.gray}`
  }
}));

/**
 * Exports a styled table row to be used inside the table header and body.
*/
const StyledTableRow = styled(TableRow, { name: 'StyledTableRow' })({
  '&.MuiTableRow-root': {
    display: 'inline-table', // when using display block (while trying to display the scrollbar
    // only in the table body), the table had a strange behavior and
    // failed to take all the 100% of the width of the size
    // of the container and the scrollbar was separated from the table.
    width: '100%',
  },
  head: {
    height: '40px', // defined to subtract it from the total table height
    // to make the scrollbar start from the body
    width: '99%', // defined to align cells of header and body, avoids the 1% that the scrollbar in the body is using"
  },
  selected: {
    backgroundColor: 'rgba(0, 0, 0, 0.04) !important'
  }
});

export {
  StyledTableContainer,
  StyledTableBody,
  StyledTableCell,
  StyledTableRow
};
