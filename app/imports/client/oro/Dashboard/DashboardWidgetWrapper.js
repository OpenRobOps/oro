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
    padding: '9.5px'
  },
  withoutPadding: {
    padding: 0
  },
  widget: {
    display: 'flex',
    flexDirection: 'column',
    background: theme.palette.background.surface,
    border: `1px solid ${theme.palette.background.borderLight}`,
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
    paddingBottom: '12px'
  },
  widgetLabel: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: '300',
    fontSize: '1.125rem',
    display: 'flex',
    alignItems: 'center'
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
    color: theme.palette.incidents.inactive
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
      key={id}
      data-test={dataTest}
      className={classNames(
        classes.container,
        { [classes.withoutPadding]: withoutPadding },
        { [classes.controlWidgetContainer]: controlWidget },
        { [classes.mobileControlWidgetContainer]: isMobile }
      )}
      size={{
        xs: 12,
        md: width || 4
      }}>
      <div className={
        classNames(
          classes.widget,
          { [classes.controlWidget]: controlWidget },
          { [classes.withoutBackground]: withoutBackground }
        )}
      >
        {((chroma && widgetTitle) || toolbar) && (
          <div className={classes.widgetTitleBar}>
            <Typography className={classes.widgetLabel}>
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
  ])
};

export default DashboardWidgetWithContextWrapper;
