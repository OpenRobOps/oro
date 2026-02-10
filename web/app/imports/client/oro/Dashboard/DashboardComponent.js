/*
 * Dashboard Meteor Agnostic Component
 *
 * Displays widgets received in sections
 * This Component should remain meteor free
 *
 */
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import Divider from '@mui/material/Divider';
import { Typography } from '@mui/material';
import { withStyles } from 'tss-react/mui';
// ORO modules
import ErrorBoundary from '../ErrorBoundary';
import Section from './SectionComponent';
// import { LocalizationWidgetProvider } from '../../contexts/LocalizationWidgetContext';

/**
 * Creates and returns a toolbar element for a given widget specification.
 *
 * @param {object} toolbarFactory object mapping widget types to toolbar factory functions
 * @param {object} widgetSpec widget specification, must include a type
 * @param {object} context dashboard context, data there will be used to create toolbar elements
 * @param {func} setContext
 *   function setting a new dashboard context given the current one, used to build callbacks
 *   passed to the widget being built to mutate the dashboard context (for example, on robot
 *   selection).
 * @return
 *   toolbar element, or null if toolbarFactory define no toolbar element for widgetSpec.type
 */
const createToolbar = toolbarFactory => (
  companyId,
  widgetSpec,
  context,
  setContext,
  switchTo,
  isZeroData
) => {
  const { type, scope = {}, id: widgetId, config } = widgetSpec;
  if (toolbarFactory && (type in toolbarFactory)) {
    return toolbarFactory[type]({
      companyId,
      config,
      widgetId,
      context,
      scope,
      setContext,
      switchTo,
      isZeroData
    });
  }
  return null;
};

/**
 * Creates and returns a dashboard widget given its specification.
 * The fundamental properties of a widget specification are:
 *
 *   - type: for example, as defined in GC_WIDGET_TYPES in lib/uiPreferences.js.
 *     This property is used as the lookup key in widgetFactory, defining the
 *     widget to instantiate.
 *   - config: object holding the configuration properties for the widget to
 *     instantiate. This matches the configuration items you'd find in the
 *     "settings" page (Robot Data section).
 *   - scope: object defining the read and write scopes for the widget
 *     to instantiate. See example below.
 *
 * Scope example: for a scope = {read: "r", write: "w"}, the widget
 * to instantie will use:
 *
 *   - Key "r.selectedRobotId" to get the "selectedRobotId" property from the dashboard context
 *   - Key "w.selectedRobotId" to write the "selectedRobotId" property to the dashboard context
 *
 * @param {object} widgetSpec widget specification, must include a type
 * @param {object} widgetFactory object mapping widget types to widget factory functions
 * @param {object} context
 *   dashboard context, needed to access dashboard context props to be passed to the widget
 *   widget being built (for example, selected robot Id).
 * @param {func} setContext
 *   function setting a new dashboard context given the current one, used to build callbacks
 *   passed to the widget being built to mutate the dashboard context (for example, on robot
 *   selection).
 *
 * @return
 *   widget element, or component with error message if no factory function
 *   in widgetFactory for widgetSpec.type. The returned component will read
 *   and write properties from/to the dashboard context.
 */
const createWidget = widgetFactory => (
  companyId,
  widgetSpec,
  context,
  setContext,
  switchTo,
  isZeroData
) => {
  const { type, config, scope = {} } = widgetSpec;
  if (widgetFactory && type in widgetFactory) {
    return widgetFactory[type]({
      companyId,
      config,
      context,
      setContext,
      switchTo,
      scope,
      isZeroData
    });
  } else {
    console.error('Dashboard: Do not know how to render widget of type ' + type);
    return (
      <Typography>
        {`Unknown widget type: ${type}`}
      </Typography>
    );
  }
};

/**
 * Dashboard component: holds a user-defined set of sections,
 * each grouping widgets.
 *
 * @param {object} props dashboard properties
 */

const styles = theme => ({
  divider: {
    height: '4px',
    margin: '0',
    border: '0',
    backgroundColor: theme.palette.background.lightBackground,
  },
  dashboard: {
    backgroundColor: theme.palette.background.lightBackground,
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    // Reserve space for scrollbar to ensure consistent alignment
    scrollbarGutter: 'stable',
  }
});

const Dashboard = (props) => {
  const {
    classes,
    theme,
    dashboardSpec,
    context,
    setContext,
    switchTo,
    widgetFactory,
    toolbarFactory,
    companyId,
    isZeroData,
    guideBanner = null,
  } = props;

  useEffect(() => {
    document.body.style.overflowY = 'hidden';
  });

  // Create renderer function for widgets (and toolbars), that each section
  // will simply invoke with each widget config
  const widgetRenderer = createWidget(widgetFactory);
  const toolbarRenderer = createToolbar(toolbarFactory);
  return (
    <ErrorBoundary>
      <div className={classes.dashboard} key={dashboardSpec._id}>
        {/*
          * if there is a zero data case
          * this banner will appear to
          * to encourage the user to add a robot
        */
          guideBanner
        }
        {Array.isArray(dashboardSpec.sections) && !!dashboardSpec.sections.length ? (
          dashboardSpec.sections.map((section, ix) => ([
            (ix > 0) && (
              <Divider
                variant="fullWidth"
                className={classes.divider}
                key={`divider-${section.id}`}
              />
            ),
            // <LocalizationWidgetProvider sectionScope={section.scope}>
              <Section
                {...section}
                key={`${dashboardSpec._id}-${section._id || ix}`}
                theme={theme}
                companyId={companyId}
                widgetRenderer={widgetRenderer}
                toolbarRenderer={toolbarRenderer}
                context={context}
                setContext={setContext}
                switchTo={switchTo}
                isZeroData={isZeroData}
              />
            // </LocalizationWidgetProvider>
          ]))
        ) : (
          <Typography data-test="empty-dashboard-message">
            Dashboard has no sections
          </Typography>
        )}
      </div>
    </ErrorBoundary>
  );
};

Dashboard.defaultProps = {
  dashboardSpec: {}
};

Dashboard.propTypes = {
  classes: PropTypes.object,
  theme: PropTypes.object,
  dashboardSpec: PropTypes.object,
  context: PropTypes.object.isRequired,
  setContext: PropTypes.func.isRequired,
  switchTo: PropTypes.func.isRequired,
  widgetFactory: PropTypes.object,
  toolbarFactory: PropTypes.object,
  companyId: PropTypes.string,
  isZeroData: PropTypes.bool,
  guideBanner: PropTypes.object
};

export default withStyles(Dashboard, styles, { withTheme: true });
