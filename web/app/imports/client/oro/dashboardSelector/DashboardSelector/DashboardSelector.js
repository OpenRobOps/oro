/**
 * Renders a tabs component, with a tab for each dashboard available
 * to the current user.
 *
 * This is a meteor-free component. It is intended to be used contained
 * in a DashboardSelectorContainer widget, which provides the dashboard
 * specifications for the current user.
 */
import React, { useEffect, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router';
import {
  Tabs, Tab, Box, IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { withStyles } from 'tss-react/mui';
import { isObject } from 'lodash';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HistoryIcon from '@mui/icons-material/History';
// ORO modules
import { DashboardUrl } from '../../../../lib/urlBuilder';
import Loading from '../../util/Loading';
import { useUrlContext } from '../../contexts/UrlContextContext';
import { SECTION_SCOPES } from '../../../../shared/uiPreferences';
import { countDashboardSectionsWithScopes } from '../../../../shared/dashboards';
// import { writeCtx } from '../../../../lib/context';

const StyledTabs = styled(Tabs)(({ theme }) => ({
  '&.MuiTabs-root': {
    background: theme.palette.background.navDark,
    minHeight: '32px', // MUI's default is 48
    height: '44px',
    flex: 1,
  },
  '& .MuiTab-root': {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontSize: '16px',
    minHeight: '44px',
    color: '#AAAAAA',
    textTransform: 'capitalize',
    padding: '0px 28px',
    minWidth: '180px',
    letterSpacing: '0.01em',
    fontOpticalSizing: 'auto',
    fontWeight: 400
  },
  '& .MuiTabs-indicator': {
    display: 'none'
  },
}));

const StyledTab = styled(props => (
  <Tab disableRipple {...props} />
))(({ theme }) => ({
  '&.Mui-selected': {
    color: theme.palette.text.contrastText,
    borderBottom: `3px solid ${theme.palette.background.tabSelected}`
  }
}));

/**
 * Container for the tabs
 */
const TabsContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  background: theme.palette.background.navDark,
  position: 'sticky',
  top: 0,
  zIndex: 1000,
  height: '45px',
  flexShrink: 0
}));

/**
 * Flex container for Copilot panel + dashboard content (below navbar)
 */
const ContentFlexContainer = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
});

/**
 * Wrapper for dashboard panels
 */
const DashboardPanelsWrapper = styled('div')({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

/**
 * Update the current url to reflect the currently selected dashboard
 * and its context.
 */
const updateUrl = ({ location, navigate, dashboardId }) => {
  if (!location) {
    console.error('updateUrl: location is undefined', location);
  }
  const pathname = dashboardId
    ? new DashboardUrl().dashboard(dashboardId).build()
    : location && location.pathname;
  if (location && pathname != location.pathname) {
    navigate(`${pathname}${location.search}`);
  }
};

const a11yProps = (label, index) => ({
  id: `simple-tab-${index}`,
  'aria-controls': `dashboard-${label}`,
});

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      style={{
        flex: 1,
        minHeight: 0,
        display: value === index ? 'flex' : 'none',
        flexDirection: 'column',
      }}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};

const styles = theme => ({
  root: {
    flexGrow: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
});

const selectDashboardTab = (dashboardSpecs, dashboardId, initialDashboardId) => {
  let selectedTabIndex = -1;
  if (dashboardId) {
    selectedTabIndex = dashboardSpecs.findIndex(({ _id }) => _id == dashboardId);
  }
  if (selectedTabIndex == -1 && initialDashboardId) {
    selectedTabIndex = dashboardSpecs.findIndex(({ _id }) => _id == initialDashboardId);
  }
  if (selectedTabIndex == -1) {
    selectedTabIndex = dashboardSpecs.findIndex(d => d.label == 'Fleet');
  }
  return Math.max(selectedTabIndex, 0);
};

const DashboardSelector = (props) => {
  const {
    classes,
    isLoading,
    dashboardSpecs,
    initialDashboardId,
    dashboardId,
    NotificationsClient,
    Dashboard,
    hideTabs,
    muteNotifications = localStorage.getItem('muteNotifications') === 'true',
    RobotOfflineBar,
    sidePanel,
  } = props;

  const [tabIndex, setTabIndex] = useState(0);
  const [context, setContext] = useUrlContext();
  const navigate = useNavigate();
  const location = useLocation();

  const updateStateAndUrl = useCallback((newTabIndex = 0) => {
    setTabIndex(newTabIndex);
    updateUrl({
      location, navigate, dashboardId: dashboardSpecs[newTabIndex]._id
    });
  }, [location, dashboardSpecs]);

  const handleTabChange = useCallback(
    (_, newTabIndex) => updateStateAndUrl(newTabIndex),
    [updateStateAndUrl]
  );

  useEffect(() => {
    if (dashboardSpecs && dashboardSpecs.length) {
      const newTabIndex = selectDashboardTab(dashboardSpecs, dashboardId, initialDashboardId);
      updateStateAndUrl(newTabIndex);
    }
  }, [dashboardSpecs, dashboardId, initialDashboardId]);

  const switchTo = useCallback((query) => {
    if (dashboardSpecs) {
      if ('scope' in query) {
        const i = dashboardSpecs.findIndex(d => d.sections.find(s => s.scope == query.scope));
        if (i != -1) {
          updateStateAndUrl(i);
          return true;
        }
      }
    }
    return false;
  }, [dashboardSpecs]);

  if (isLoading) {
    return <Loading />;
  }
  const { root } = classes;
  return (
    <div className={root}>
      {!hideTabs && (
        <TabsContainer>
          {/* Dashboard tabs */}
          <StyledTabs
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="dashboards selector"
            data-test="dashboard-section-selector"
            variant="scrollable"
            scrollButtons="auto"
          >
            {
              dashboardSpecs.map(({ label }, i) => (
                <StyledTab
                  key={label}
                  label={label}
                  data-test="dashboard-section-button"
                  {...a11yProps(label, i)}
                />
              ))
            }
          </StyledTabs>
        </TabsContainer>
      )}
      <ContentFlexContainer>
        {sidePanel}
        <DashboardPanelsWrapper>
          {!muteNotifications
            && NotificationsClient && (
              <NotificationsClient />
          )}
          {dashboardSpecs.map((dashboardSpec, i) => (
            <TabPanel
              value={tabIndex}
              key={dashboardSpec.label}
              index={i}
            >
              {
                countDashboardSectionsWithScopes(
                  dashboardSpec,
                  [SECTION_SCOPES.ROBOT, SECTION_SCOPES.NAVIGATION]
                ) > 0 && (
                  <RobotOfflineBar context={context} />
                )
              }
              <Dashboard
                dashboardSpec={dashboardSpec}
                context={context}
                setContext={setContext}
                switchTo={switchTo}
              />
            </TabPanel>
          ))}
        </DashboardPanelsWrapper>
      </ContentFlexContainer>
    </div>
  );
};

DashboardSelector.propTypes = {
  classes: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired,
  dashboardSpecs: PropTypes.array,
  initialDashboardId: PropTypes.string,
  dashboardId: PropTypes.string,
  NotificationsClient: PropTypes.func,
  Dashboard: PropTypes.func,
  hideTabs: PropTypes.bool,
  muteNotifications: PropTypes.bool,
  RobotOfflineBar: PropTypes.func,
  sidePanel: PropTypes.node,
};

export default withStyles(DashboardSelector, styles, { withTheme: true });
