/**
 * Dashboard Widget Wrapper
 *
 * Meteor agnostic widget wrapper
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, Tooltip } from '@mui/material';
import { Label } from '@mui/icons-material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { makeStyles } from 'tss-react/mui';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import ErrorBoundary from '../ErrorBoundary';
import { useWidgetData, WidgetDataProvider } from '../contexts/WidgetDataContext';

const useStyles = makeStyles()(theme => ({
  container: {
    padding: '6px'
  },
  withoutPadding: {
    padding: 0
  },
  widget: {
    display: 'flex',
    flexDirection: 'column',
    background: 'white',
    boxShadow: `5px 5px 10px ${theme.palette.boxShadow.light}, -3px -3px 5px 1px ${theme.palette.boxShadow.white}`,
    borderRadius: '10px',
    padding: '12px'
  },
  controlWidget: {
    padding: '3px 3px'
  },
  controlWidgetContainer: {
    padding: '3px 0px'
  },
  mobileControlWidgetContainer: {
    paddingTop: '10px'
  },
  iconStyle: {
    padding: '3px'
  },
  widgetTitleBar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    height: '32px',
    paddingBottom: '6px'
  },
  widgetLabel: {
    fontFamily: 'Roboto',
    fontWeight: '300',
    fontSize: '1.125rem'
  },
  widgetToolbar: {
    float: 'right',
    maxHeight: '32px',
    flex: '1'
  },
  withoutBackground: {
    background: 'transparent',
    boxShadow: 'none',
    padding: '0'
  },
  widgetContentContainer: {
    '& *': {
      '&::-webkit-scrollbar': {
        background: theme.palette.background.white,
        width: '6px',
        height: '6px'
      },
      '&::-webkit-scrollbar-thumb': {
        background: theme.palette.background.lightGray,
        borderRadius: '3px'
      }
    }
  },
  tooltipTagContainer: {
    padding: '4px 0'
  },
  tooltipTagSubContainer: {
    display: 'flex',
    alignItems: 'center',
    marginRight: '4px'
  },
  tooltipTagTitle: {
    fontSize: '10px',
    fontWeight: 500,
    textAlign: 'center',
    paddingBottom: '4px'
  },
  tooltipTagLabel: {
    fontSize: '10px',
    marginLeft: '10px',
  },
  labelIcon: {
    color: '#BCBCBC'
  },
  numberOfTags: {
    position: 'absolute',
    top: '0',
    right: '0',
    width: '27px',
    height: '23px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px'
  },
  iconContent: {
    position: 'relative',
    display: 'flex',
    marginLeft: '4px'
  }
}));

/**
 * Small component to add a title and border for dashboards widgets with chroma: true.
 * It receives the following properties:
 *   contents: Rendered contents, a child react component
 *   classes: <object> with css classes definitions
 *   width: <number, optional> width for `md` Grid property (4 or 8 normally)
 *   id: <string> key for element, must be unique under same parent
 *   toolbar: Rendered toolbar content, a child react component
 *
 * Note: title was moved to WidgetDataContext, so that widgets can modify it (other properties
 * may follow in the future).
 */
const DashboardWidgetWrapper = (props) => {
  const {
    id, width, toolbar, contents, height, chroma, conditionalTagList,
    dataTest, controlWidget, withoutBackground, withoutPadding
  } = props;
  const { classes } = useStyles();
  const { widgetTitle } = useWidgetData();
  const isMobile = useMediaQuery('(max-width:900px)');

  return (
    <Grid
      item
      xs={12}
      md={width || 4}
      key={id}
      data-test={dataTest}
      className={classNames(
        classes.container,
        { [classes.withoutPadding]: withoutPadding },
        { [classes.controlWidgetContainer]: controlWidget },
        { [classes.mobileControlWidgetContainer]: isMobile }
      )}
    >
      <div className={
        classNames(
          classes.widget,
          { [classes.controlWidget]: controlWidget },
          { [classes.withoutBackground]: withoutBackground }
        )}
      >
        {((chroma && widgetTitle) || toolbar) && (
          <div className={classes.widgetTitleBar}>
            <Typography variant="subtitle1" className={classes.widgetLabel}>
              {chroma && widgetTitle}
            </Typography>
            <div className={classes.widgetToolbar}>
              {toolbar}
            </div>
          </div>
        )}
        <div style={height && { height }}>
          {/* Error boundary at widget level allows a more graceful page crash, leaving
              other widgets still functional */}
          <ErrorBoundary variant="widget">
            {contents}
          </ErrorBoundary>
        </div>
      </div>
    </Grid>
  );
};

DashboardWidgetWrapper.propTypes = {
  id: PropTypes.string,
  width: PropTypes.number,
  chroma: PropTypes.bool,
  toolbar: PropTypes.object,
  contents: PropTypes.object,
  height: PropTypes.string,
  dataTest: PropTypes.string,
  controlWidget: PropTypes.bool,
  withoutBackground: PropTypes.bool,
  withoutPadding: PropTypes.bool,
  conditionalTagList: PropTypes.arrayOf(PropTypes.string)
};

/**
 * Wrapper to provide the WidgetDatContext (to share data between widget component and its
 * toolbar)
 */
const DashboardWidgetWithContextWrapper = ({ children, title, ...props }) => (
  <WidgetDataProvider title={title}>
    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
    <DashboardWidgetWrapper {...props}>
      {children}
    </DashboardWidgetWrapper>
  </WidgetDataProvider>
);
DashboardWidgetWithContextWrapper.propTypes = {
  title: PropTypes.string, // initial title (can be changed through context)
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
};

export default DashboardWidgetWithContextWrapper;
