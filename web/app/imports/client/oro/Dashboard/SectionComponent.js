/*
 * Dashboard Section Meteor Agnostic Component
 *
 * Renders a dashboard section given the section config, and a list of widgets
 * components.

 * This Component should remain meteor free.
 *
 * TODO(franguerini):
 *   - Add proper design with proper spacing between sections + components
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, Tooltip } from '@mui/material';
import { Label } from '@mui/icons-material';
import { withStyles } from 'tss-react/mui';
import useMediaQuery from '@mui/material/useMediaQuery';
import { isEmpty, isString, isInteger } from 'lodash';
import classnames from 'classnames';
// ORO modules
import DashboardWidgetWrapper from './DashboardWidgetWrapper';
import { SECTION_SCOPES, WIDGET_CONFIG, WIDGET_TYPE_GROUP, WIDGET_TYPES_IDS } from '../../../lib/uiPreferences';
// import { ActiveInteractionProvider } from '../../contexts/ActiveInteractionContext';
// import { LayoutProvider } from '../../navigationWidgets/LayoutManager';

const styles = theme => ({
  // TODO(herchu) these classes were copied unmodified from GroundControl;
  // adjust them as we add toolbars
  section: {
    padding: '6px 24px'
  },
  componentTitle: {
    fontWeight: theme.fontWeight.light,
    fontSize: '1.375rem',
    lineHeight: '1.6rem',
  },
  titleFlex: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  titleButtons: {
    display: 'flex',
    margin: '6px',
    marginBottom: '4px',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleMobile: {
    display: 'flex',
    flexDirection: 'column'
  },
  infoName: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: '100%'
  },
  widget: {
    display: 'flex',
    flexDirection: 'column'
  },
  labelIcon: {
    color: '#BCBCBC'
  },
  iconContent: {
    position: 'relative',
    display: 'flex',
    marginLeft: '4px'
  }
});

// Magic height in pixels used system-wide for GC or "chromed" widgets
const MAGIC_HEIGHT_PX = 350;

// Contains the widgets that can be added to the title of a section if "withControlWidget" is true
// NOTE (Flor_Grosso): Control bars don't need a label, however a label was added to
// build the `data-test` field for e2e tests & Pendo guides. It is NOT MEANT TO BE DISPLAYED
// on the UI.
const CONTROL_WIDGET_CONFIGS = {
  [SECTION_SCOPES.ROBOT]: {
    type: WIDGET_TYPES_IDS.ROBOT_CONTROL_BAR,
    label: 'Robot Control Bar',
    layout: {
      grid: WIDGET_CONFIG.MEDIUM_PLUS_GRID
    }
  },
  [SECTION_SCOPES.FLEET]: {
    type: WIDGET_TYPES_IDS.FLEET_CONTROL,
    label: 'Fleet Control Bar',
    layout: {
      grid: WIDGET_CONFIG.MEDIUM_PLUS_GRID
    }
  },
  [SECTION_SCOPES.NAVIGATION]: {
    type: WIDGET_TYPES_IDS.NAVIGATION_CONTROL_BAR,
    label: 'Navigation Control Bar',
    layout: {
      grid: WIDGET_CONFIG.MEDIUM_PLUS_GRID
    }
  },
  [SECTION_SCOPES.MISSION]: {
    type: WIDGET_TYPES_IDS.MISSION_CONTROL_BAR,
    label: 'Mission Control Bar',
    layout: {
      grid: WIDGET_CONFIG.MEDIUM_PLUS_GRID
    }
  },
  [SECTION_SCOPES.LOCATION]: {
    type: WIDGET_TYPES_IDS.LOCATION_CONTROL_BAR,
    label: 'Location Control Bar',
    layout: {
      grid: WIDGET_CONFIG.MEDIUM_PLUS_GRID
    }
  },
};

/**
 * Compute CSS height property from the given layout.
 * @param {object} layout widget layout (can be falsy)
 */
const widgetCssHeight = (layout = {}) => {
  const { height } = layout;
  if (isString(height)) {
    // A string height is interpreted as a valid CSS height property
    return height;
  } else if (isInteger(height)) {
    // An integer height is interpreted as a multiple of the magic height
    return `${MAGIC_HEIGHT_PX * height}px`;
  } else {
    // Don't force a height, let widget claim as much space as it wants
    return null;
  }
};

/**
 * Section component.
 *
 * @param {object} props component properties
 */
const Section = (props) => {
  const {
    // common widget props
    classes,
    // section props
    id, label, widgets, scope, withControlWidget,
    // dashboard and context specific props
    widgetRenderer, toolbarRenderer, context, setContext, switchTo, isZeroData
  } = props;

  const isMobile = useMediaQuery('(max-width:900px)');

  /**
   * Render a single widget accordingly to the given widget specification.
   *
   * @param {object} widgetSpec widget specification
   * @param {boolean} controlWidget if true then it will render the widget as a control widget
   */
  const renderWidget = (widgetSpec, controlWidget = false, index = '') => {
    const widget = widgetRenderer(
      widgetSpec,
      context,
      setContext,
      switchTo,
      isZeroData
    );
    const layout = widgetSpec.layout || {};
    const width = (layout && layout.grid) || 4;
    const height = widgetCssHeight(layout);
    const withoutBackground = layout && layout.withoutBackground;
    const initialTitle = widgetSpec.label;
    return (
      <DashboardWidgetWrapper
        key={`${id || index}-${initialTitle}`}
        title={initialTitle}
        contents={widget}
        height={height}
        width={width}
        chroma={layout.chroma}
        toolbar={
          toolbarRenderer(widgetSpec, context, setContext, switchTo, isZeroData)
        }
        dataTest={`dashboard-widget-${initialTitle}`}
        controlWidget={controlWidget}
        withoutBackground={withoutBackground}
      />
    );
  };

  /**
   * Render a group of widgets inside a 12-cell grid.
   *
   * @param {array} widgets  specs of the widgets to render inside the gird
   */
  const render = widgetSpecs => (Array.isArray(widgetSpecs) && !!widgetSpecs.length ? (
    <Grid container data-test="dashboard-section-widget-container">
      {widgetSpecs.map((widgetSpec, ix) => {
        if (widgetSpec.type == WIDGET_TYPE_GROUP) {
          const { layout = {}, widgets: renderWidgets } = widgetSpec;
          return (
            <Grid item xs={12} md={layout.width || 4}>
              {render(renderWidgets)}
            </Grid>
          );
        } else {
          return renderWidget(widgetSpec, false, ix);
        }
      })}
    </Grid>
  ) : (
    <Typography sx={{ padding: theme => theme.spacing(1), paddingRight: 0 }} data-test="dashboard-section-no-widgets">
      Section has no widgets
    </Typography>
  ));

  // NOTE(herchu) NavigationDetail requires its own context provided by ActiveInteractionProvider.
  // It cannot be rendered by NavigationDetailComponent itself since it needs to be shared with
  // its control bar. So we include the provider in the render at section level
  return (
    // <ActiveInteractionProvider>
      // <LayoutProvider>
        <Grid container className={classes.section} key={id}>
          {label && (
            <Grid item xs={12} className={classes.labelContainer}>
              <div
                className={
                  classnames(classes.titleButtons, { [classes.titleMobile]: isMobile })
                }
              >
                {label && (
                  <div className={classes.titleFlex}>
                    <div className={classes.infoName}>
                      <Typography className={classes.componentTitle} data-test="dashboard-section-label">
                        {label}
                      </Typography>
                    </div>
                  </div>
                )}
                {withControlWidget && CONTROL_WIDGET_CONFIGS[scope]
                  && renderWidget(CONTROL_WIDGET_CONFIGS[scope], true)}
              </div>
            </Grid>
          )}
          <Grid item xs={12}>
            {render(widgets)}
          </Grid>
        </Grid>
      // </LayoutProvider>
    // </ActiveInteractionProvider>
  );
};

Section.defaultProps = {
  label: ''
};

Section.propTypes = {
  // common widget props
  classes: PropTypes.object,
  // section props
  id: PropTypes.string,
  label: PropTypes.string,
  scope: PropTypes.string.isRequired,
  withControlWidget: PropTypes.bool,
  widgets: PropTypes.array,
  // dashboard and context specific props
  widgetRenderer: PropTypes.func,
  toolbarRenderer: PropTypes.func,
  context: PropTypes.object,
  setContext: PropTypes.func,
  switchTo: PropTypes.func,
  isZeroData: PropTypes.bool,
};

/**
 * Wraps <Section> with the contexts required based on the scope type
 */
const SectionWithContexts = (props) => {
  if (props?.scope === SECTION_SCOPES.LOCATION) {
    return (
      <LocationsEditorProvider>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <Section {...props} />
      </LocationsEditorProvider>
    );
  } else if (props?.scope === SECTION_SCOPES.ORDER) {
    return (
      <OrdersReportProvider>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <Section {...props} />
      </OrdersReportProvider>
    );
  }
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Section {...props} />;
};

SectionWithContexts.propTypes = {
  scope: PropTypes.string.isRequired
};

export default withStyles(SectionWithContexts, styles, { withTheme: true });
