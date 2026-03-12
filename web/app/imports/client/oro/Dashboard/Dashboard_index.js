/**
 * Dashboard Meteor dependant component
 */
import React, { useEffect, useMemo } from 'react';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import fp from 'lodash/fp';
import detectMobile from 'ismobilejs';
// ORO modules
import { FullscreenProvider } from '../contexts/FullscreenContext';
import { DarkModeProvider } from '../contexts/DarkModeContext';
import { NowTimeProvider, NowTimeContext } from '../util/timeUtils/NowTimeContext';
import { validateStartTime } from '../util/timeUtils';
import DashboardComponent from './DashboardComponent';
import ListData from '../robotWidgets/ListDataWidget';
// import NavigationToolbar from './widgetToolbars/NavigationToolbar';
// import SettingsToolbar from './widgetToolbars/SettingsToolbar';
// import DataBagsToolbar from './widgetToolbars/DataBagsToolbar';
import LiveButtonToolbar from './widgetToolbars/LiveButtonToolbar';
import IncidentsFilter from './widgetToolbars/ToolbarFilters/IncidentsFilter';
// import LocalizationAdapter from '../robotWidgets/LocalizationWidget/LocalizationAdapter';
import CustomDataWidget from '../robotWidgets/CustomDataWidget';
// import ImageWidget from '../robotWidgets/ImageWidget';
import { WIDGET_TYPES, WIDGET_TYPES_IDS } from '../../../lib/uiPreferences';
// import NavigationDetail from '../navigationWidgets/NavigationDetail';
// import TimelineWidget from '../robotWidgets/TimelineWidget';
import VitalsWidget from '../robotWidgets/VitalsWidget';
// import DiagnosticsWidget from '../robotWidgets/DiagnosticsWidget';
// import DataBagWidget from '../robotWidgets/DataBagWidget';
// import LogsWidget from '../robotWidgets/LogsWidget';
// import CameraView from '../robotWidgets/CameraView';
// import IncidentTimeline from '../fleetWidgets/IncidentTimeline';
import IncidentList from '../fleetWidgets/IncidentList';
// import ActionsWidget from '../robotWidgets/ActionsWidget';
// import RobotMissionsTracker from '../robotWidgets/RobotMissionsTracker';
// import RobotSearch from '../util/RobotSearch';
import {
  CTX_PROPS,
  CONTEXT_SLOTS,
  readRobotProp,
  writeRobotProp,
  readFleetProp,
  writeFleetProp,
  readIncidentProp,
  writeIncidentProp,
  readNavigationProp,
  writeNavigationProp,
  readTimeProp,
  writeTimeProp,
  readAuditLogProp,
  writeAuditLogProp,
  deleteAuditLogProp,
  writeMissionProp,
  readMissionProp,
  readOrderProp,
  writeOrderProp,
} from '../../../lib/context';
// import FleetControlWidget from '../fleetWidgets/FleetControlWidget';
import FleetStatusWidget from '../fleetWidgets/FleetStatusWidget';
import RobotControlBar from '../robotWidgets/RobotControlBar';
// import ROSDiagnosticsFilter from './widgetToolbars/ToolbarFilters/ROSDiagnosticsFilter';
// import MissionToolbar from './widgetToolbars/MissionToolbar';
// import NavigationControlBar from '../navigationWidgets/NavigationControlBar';
// import AISummaryToolbar from './widgetToolbars/AISummaryToolbar';
// import {
//   SECTION_ROBOT_DATA,
//   SECTION_INSIGHTS,
// } from '../../../shared/constants';
// import VerbosityLevelFilter from './widgetToolbars/ToolbarFilters/VerbosityLevelFilter';
// import RobotLogFilter from './widgetToolbars/ToolbarFilters/RobotLogFilter';
// import FleetLogFilter from './widgetToolbars/ToolbarFilters/FleetLogFilter';
// import AuditLogsFleet from '../fleetWidgets/AuditLogs/AuditLogsFleet';
// import AuditLogsRobot from '../fleetWidgets/AuditLogs/AuditLogsRobot';
// // Time Capsule widgets
// import { DATA_BAG_VARIANT } from '../robotWidgets/DataBagWidget/constants';
// import TimelineFilter from './widgetToolbars/ToolbarFilters/TimelineFilter';
// import IncidentTimelineFilter from './widgetToolbars/ToolbarFilters/IncidentTimelineFilter';
// import { DEFAULT_DATA_SOURCES } from '../robotWidgets/LocalizationWidget/LocalizationDataSources';
// import { RobotsDataProvider } from '../contexts/RobotsDataContext/RobotsDataContext';
// import { LOCALIZATION_VARIANTS } from '../robotWidgets/LocalizationWidget/Localization';
// import { useZeroData } from '../util/hooks';
// import { MissionControlBarComponentWithMissionCtx } from '../missionWidgets/MissionControlBar';

// Sets the robot id in the robotId local storage if the robotId
// is null then it removes the robotId from local storage
const writeRobotIdInLocalStorage = (robotId) => {
  if (robotId) {
    localStorage.setItem(CTX_PROPS.ROBOT_ID, robotId);
  } else {
    localStorage.removeItem(CTX_PROPS.ROBOT_ID);
  }
  return robotId;
};

/**
 * Function used to save a context with an array structure as string
 * @param {Array} newArray - Array of strings
 */
const parseArrayToStringContext = array => array && array.join(',');

/**
 * Function used to parse a string context into an array of strings
 * @param {string} stringContext - string with a context separated by ","
 */
const parseStringContextToArray = stringContext => stringContext && stringContext.split(',');

// Convenience functions for operating on context robot props
const getRobotId = (context, scope = {}) => (
  readRobotProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ROBOT_ID })
);

const setRobotId = (setContext, scope = {}) => (
  fp.compose(setContext, writeRobotProp({ scope: scope.write, prop: CTX_PROPS.ROBOT_ID }),
    writeRobotIdInLocalStorage)
);

// Convenience functions for operating on context fleet props
const getFleetGroupBy = (context, scope = {}) => (
  readFleetProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.GROUP_BY })
);
const setFleetGroupBy = (setContext, scope = {}) => (
  fp.compose(setContext, writeFleetProp({ scope: scope.write, prop: CTX_PROPS.GROUP_BY }))
);
const getFleetSortBy = (context, scope = {}) => (
  readFleetProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.SORT_BY })
);
const setFleetSortBy = (setContext, scope = {}) => (
  fp.compose(setContext, writeFleetProp({ scope: scope.write, prop: CTX_PROPS.SORT_BY }))
);
const getFleetRobotStatus = (context, scope = {}) => (
  readFleetProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ROBOT_STATUS })
);
const setFleetRobotStatus = (setContext, scope = {}) => (
  fp.compose(setContext, writeFleetProp({ scope: scope.write, prop: CTX_PROPS.ROBOT_STATUS }))
);
const getFleetAttributeStatus = (context, scope = {}) => (
  readFleetProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ATTR_STATUS })
);
const setFleetAttributeStatus = (setContext, scope = {}) => (
  fp.compose(setContext, writeFleetProp({ scope: scope.write, prop: CTX_PROPS.ATTR_STATUS }))
);
// Convenience functions for operating on context audit logs
const getEventType = (context, scope = {}) => (
  readAuditLogProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.EVENT_TYPE })
);
const setEventType = (setContext, scope = {}) => (
  fp.compose(setContext, writeAuditLogProp({ scope: scope.write, prop: CTX_PROPS.EVENT_TYPE }))
);
const deleteEventType = (setContext, scope = {}) => ( // eslint-disable-line no-unused-vars
  (fp.compose(
    setContext,
    deleteAuditLogProp({ scope: scope.delete, prop: CTX_PROPS.EVENT_TYPE })
  ))
);
const getEventModule = (context, scope = {}) => (
  readAuditLogProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.EVENT_MODULE })
);
const setEventModule = (setContext, scope = {}) => (
  fp.compose(setContext, writeAuditLogProp({ scope: scope.write, prop: CTX_PROPS.EVENT_MODULE }))
);
const deleteEventModule = (setContext, scope = {}) => ( // eslint-disable-line no-unused-vars
  (fp.compose(
    setContext,
    deleteAuditLogProp({ scope: scope.delete, prop: CTX_PROPS.EVENT_MODULE })
  ))
);
const setUserId = (setContext, scope = {}) => (
  fp.compose(setContext, writeAuditLogProp({ scope: scope.write, prop: CTX_PROPS.USER_ID }))
);
const getUserId = (context, scope = {}) => (
  readAuditLogProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.USER_ID })
);
const deleteUserId = (setContext, scope = {}) => ( // eslint-disable-line no-unused-vars
  (fp.compose(setContext, deleteAuditLogProp({ scope, prop: CTX_PROPS.ACTION_ID })))
);
const setActionId = (setContext, scope = {}) => (
  fp.compose(setContext, writeAuditLogProp({ scope: scope.write, prop: CTX_PROPS.ACTION_ID }))
);
const getActionId = (context, scope = {}) => (
  readAuditLogProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ACTION_ID })
);
const deleteActionId = (setContext, scope = {}) => ( // eslint-disable-line no-unused-vars
  (fp.compose(setContext, deleteAuditLogProp({ scope, prop: CTX_PROPS.ACTION_ID })))
);

// Convenience functions for operating on context navigation props
const getNavigationMap = (context, scope = {}) => (
  readNavigationProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.MAP })
);
const setNavigationMap = (setContext, scope = {}) => (
  fp.compose(setContext, writeNavigationProp({ scope: scope.write, prop: CTX_PROPS.MAP }))
);

// Convenience functions for operating on context incident props
const getIncidentId = (context, scope = {}) => (
  readIncidentProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.INCIDENT_ID })
);
const setIncidentId = (setContext, scope = {}) => (
  fp.compose(setContext, writeIncidentProp({ scope: scope.write, prop: CTX_PROPS.INCIDENT_ID }))
);
const getIncidentComponent = (context, scope = {}) => (
  readIncidentProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ICM_COMPONENT })
);
const setIncidentComponent = (setContext, scope = {}) => (
  fp.compose(setContext, writeIncidentProp({ scope: scope.write, prop: CTX_PROPS.ICM_COMPONENT }))
);
const getIncidentSeverity = (context, scope = {}) => (
  parseStringContextToArray(readIncidentProp({
    ctx: context, scope: scope.read, prop: CTX_PROPS.ICM_SEVERITY
  }))
);
const setIncidentSeverity = (setContext, scope = {}) => (
  fp.compose(setContext, writeIncidentProp({
    scope: scope.write, prop: CTX_PROPS.ICM_SEVERITY
  }), parseArrayToStringContext)
);

const isMobile = detectMobile.phone;


const getRosDiagnosticsLevel = (context, scope = {}) => (
  readRobotProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.DIAGNOSTICS_LEVEL })
);
const setRosDiagnosticsLevel = (setContext, scope = {}) => (
  fp.compose(setContext, writeRobotProp({ scope: scope.write, prop: CTX_PROPS.DIAGNOSTICS_LEVEL }))
);
// Convenience functions for operating on context ROS out props
const getVerbosityLevel = (context, scope = {}) => (
  readRobotProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ROS_VERBOSITY })
);
const setVerbosityLevel = (setContext, scope = {}) => (
  fp.compose(setContext, writeRobotProp({ scope: scope.write, prop: CTX_PROPS.ROS_VERBOSITY }))
);
// Convenience functions for operating on context Time Capsule
const getStartTime = (context, scope = {}) => readTimeProp(
  { ctx: context, scope: scope.read, prop: CTX_PROPS.START_TIME, type: validateStartTime }
);
const setStartTime = (setContext, scope = {}) => fp.compose(setContext, writeTimeProp(
  { scope: scope.write, prop: CTX_PROPS.START_TIME }
));
const getTimeRangeMs = (context, scope = {}) => readTimeProp(
  { ctx: context, scope: scope.read, prop: CTX_PROPS.TIME_RANGE, type: Number }
);
const setTimeRangeMs = (setContext, scope = {}) => fp.compose(setContext, writeTimeProp(
  { scope: scope.write, prop: CTX_PROPS.TIME_RANGE }
));
const getTimeFocus = (context, scope = {}) => readTimeProp(
  { ctx: context, scope: scope.read, prop: CTX_PROPS.FOCUS_TIME, type: Number }
);
const setTimeFocus = (setContext, scope = {}) => fp.compose(setContext, writeTimeProp(
  { scope: scope.write, prop: CTX_PROPS.FOCUS_TIME }
));

// mission context
const getMissionFilter = (context, scope = {}) => (
  readMissionProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.MISSION_LABEL_FILTER })
);
const setMissionFilter = (setContext, scope = {}) => (
  fp.compose(setContext, writeMissionProp({
    scope: scope.write, prop: CTX_PROPS.MISSION_LABEL_FILTER
  }))
);

const getSummary = (context, scope = {}) => (
  readFleetProp({
    ctx: context,
    scope: scope.read,
    prop: CTX_PROPS.SUMMARY,
    type: Boolean
  })
);

const setSummary = (setContext, scope = {}) => (
  fp.compose(
    setContext,
    writeFleetProp({ scope: scope.write, prop: CTX_PROPS.SUMMARY })
  )
);

// Orders context
const getOrderStates = (context, scope = {}) => (
  readOrderProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ORDER_STATES })
);
const setOrderStates = (setContext, scope = {}) => (
  fp.compose(setContext, writeOrderProp({ scope: scope.write, prop: CTX_PROPS.ORDER_STATES }))
);
const getOrderFields = (context, scope = {}) => (
  readOrderProp({ ctx: context, scope: scope.read, prop: CTX_PROPS.ORDER_FIELDS })
);
const setOrderFields = (setContext, scope = {}) => (
  fp.compose(setContext, writeOrderProp({ scope: scope.write, prop: CTX_PROPS.ORDER_FIELDS }))
);

// Helper components used to inject context dependent props into widgets
// NOTE These components are required when the data to inject depends on some hooks.
// Calling hooks outside of a component is not allowed, so we need to wrap the widget in a component
// that can call the hooks and pass the data to the widget.
const LocalizationWidgetWithContext = ({
  /* eslint-disable react/prop-types */
  context,
  scope,
  setContext,
  isZeroData,
  config
  /* eslint-enable react/prop-types */
}) => {
  const localizationFilter = useMemo(() => {});
  return (
    <RobotsDataProvider dataSources={DEFAULT_DATA_SOURCES}>
      <LocalizationAdapter
        variant={LOCALIZATION_VARIANTS.MAP_WIDGET}
        selectedRobotId={getRobotId(context, scope)}
        selectRobotCallback={setRobotId(setContext, scope)}
        options={localizationFilter}
        // eslint-disable-next-line react/prop-types
        mapLabel={config?.mapId || getNavigationMap(context, scope)}
        isZeroData={isZeroData}
      />
    </RobotsDataProvider>
  );
};

// eslint-disable-next-line react/prop-types
const NavigationDetailWithContext = ({ context, scope, setContext, isZeroData }) => {
  return (
    <NavigationDetail
      robotId={getRobotId(context, scope)}
      isMobile={isMobile}
      selectRobotCallback={setRobotId(setContext, scope)}
      mapLabel={getNavigationMap(context, scope)}
      setMapLabel={setNavigationMap(setContext, scope)}
      isZeroData={isZeroData}
    />
  );
};

/**
 * Widget toolbars factory.
 */
// TODO: Handle no data states in toolbars
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
const TOOLBAR_FACTORY = {
  // [WIDGET_TYPES.DATA_BAGS]: ({ setContext, scope, context, isZeroData }) => (
  //   <DataBagsToolbar
  //     robotId={getRobotId(context, scope)}
  //     startTs={getStartTime(context, scope)}
  //     setStartTime={setStartTime(setContext, scope)}
  //     timeRangeMs={getTimeRangeMs(context, scope)}
  //     variant={DATA_BAG_VARIANT.DASHBOARD}
  //     isZeroData={isZeroData}
  //   />
  // ),
  [WIDGET_TYPES.KEY_VALUES]: () => <LiveButtonToolbar alwaysLive />,
  // [WIDGET_TYPES.LOCALIZATION]: ({ switchTo }) => (
  //   <NavigationToolbar
  //     navigationDetailCallback={() => switchTo({ scope: CONTEXT_SLOTS.NAVIGATION })}
  //   />
  // ),
  // [WIDGET_TYPES_IDS.CHART]: ({ config, widgetId, setContext, context, scope }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <TimelineFilter
  //         startTs={getStartTime(context, scope)}
  //         setStartTime={setStartTime(setContext, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         setTimeRangeMs={setTimeRangeMs(setContext, scope)}
  //         robotId={getRobotId(context, scope)}
  //         onTimeFocusChange={setTimeFocus(setContext, scope)}
  //         widgetId={widgetId}
  //         config={config}
  //         nowTs={nowTs}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),
  [WIDGET_TYPES_IDS.INCIDENT_LIST]: ({ context, setContext, scope, isZeroData }) => (
    <NowTimeContext.Consumer>
      {nowTs => (
        <IncidentsFilter
          selectedIncidentComponentFilter={getIncidentComponent(context, scope)}
          setSelectedIncidentComponentFilter={setIncidentComponent(setContext, scope)}
          selectedSeverityFilter={getIncidentSeverity(context, scope)}
          setSelectedSeverityFilter={setIncidentSeverity(setContext, scope)}
          startTs={getStartTime(context, scope)}
          setStartTime={setStartTime(setContext, scope)}
          isZeroData={isZeroData}
          timeRangeMs={getTimeRangeMs(context, scope)}
          setTimeRangeMs={setTimeRangeMs(setContext, scope)}
          nowTs={nowTs}
        />
      )}
    </NowTimeContext.Consumer>
  ),
  // [WIDGET_TYPES_IDS.INCIDENT_TIMELINE]: ({ context, setContext, scope }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <IncidentTimelineFilter
  //         startTs={getStartTime(context, scope)}
  //         setStartTime={setStartTime(setContext, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         setTimeRangeMs={setTimeRangeMs(setContext, scope)}
  //         nowTs={nowTs}
  //         selectedIncidentComponentFilter={getIncidentComponent(context, scope)}
  //         setSelectedIncidentComponentFilter={setIncidentComponent(setContext, scope)}
  //         selectedSeverityFilter={getIncidentSeverity(context, scope)}
  //         setSelectedSeverityFilter={setIncidentSeverity(setContext, scope)}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),
  // [WIDGET_TYPES.ROS_DIAGNOSTICS]: ({ context, setContext, scope, isZeroData }) => (
  //   <ROSDiagnosticsFilter
  //     robotId={getRobotId(context, scope)}
  //     isZeroData={isZeroData}
  //     selectedRosDiagnosticsLevel={getRosDiagnosticsLevel(context, scope)}
  //     setRosDiagnosticsLevel={setRosDiagnosticsLevel(setContext, scope)}
  //     alwaysLive
  //   />
  // ),
  // [WIDGET_TYPES.ACTIONS]: ({ isZeroData }) => (
  //   <SettingsToolbar
  //     settingsPage={SECTION_INSIGHTS}
  //     isZeroData={isZeroData}
  //   />
  // ),
  // [WIDGET_TYPES_IDS.LOGS]: ({ context, setContext, scope }) => (
  //   <VerbosityLevelFilter
  //     robotId={getRobotId(context, scope)}
  //     selectedVerbosityLevel={getVerbosityLevel(context, scope)}
  //     setVerbosityLevel={setVerbosityLevel(setContext, scope)}
  //   />
  // ),
  // [WIDGET_TYPES_IDS.AUDIT_LOG]: ({ setContext, context, scope, isZeroData }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <RobotLogFilter
  //         robotId={getRobotId(context, scope)}
  //         startTs={getStartTime(context, scope)}
  //         setStartTime={setStartTime(setContext, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         setTimeRangeMs={setTimeRangeMs(setContext, scope)}
  //         nowTs={nowTs}
  //         isZeroData={isZeroData}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),
  // [WIDGET_TYPES_IDS.AUDIT_LOG_FLEET]: ({ setContext, context, scope, isZeroData }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <FleetLogFilter
  //         robotId={getRobotId(context, scope)}
  //         setRobotId={setRobotId(setContext, scope)}
  //         startTs={getStartTime(context, scope)}
  //         setStartTime={setStartTime(setContext, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         setTimeRangeMs={setTimeRangeMs(setContext, scope)}
  //         eventType={getEventType(context, scope)}
  //         setNewEventType={setEventType(setContext, scope)}
  //         eventModule={getEventModule(context, scope)}
  //         setEventModule={setEventModule(setContext, scope)}
  //         actionId={getActionId(context, scope)}
  //         setActionId={setActionId(setContext, scope)}
  //         setUserId={setUserId(setContext, scope)}
  //         userId={getUserId(context, scope)}
  //         nowTs={nowTs}
  //         isZeroData={isZeroData}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),
  [WIDGET_TYPES_IDS.CUSTOM_DATA_TEXT]: () => <LiveButtonToolbar alwaysLive />,
  // [WIDGET_TYPES_IDS.TIME_CAPSULE_DATA_BAGS]: ({ setContext, scope, context }) => (
  //   <DataBagsToolbar
  //     robotId={getRobotId(context, scope)}
  //     startTs={getStartTime(context, scope)}
  //     setStartTime={setStartTime(setContext, scope)}
  //     timeRangeMs={getTimeRangeMs(context, scope)}
  //     variant={DATA_BAG_VARIANT.TIME_CAPSULE}
  //   />
  // ),
  // [WIDGET_TYPES_IDS.MISSION_TRACKER]: ({ setContext, scope, context }) => (
  //   <MissionToolbar
  //     missionLabelFilter={getMissionFilter(context, scope)}
  //     setMissionFilter={setMissionFilter(setContext, scope)}
  //   />
  // ),
  // [WIDGET_TYPES_IDS.FLEET_MISSION_TRACKER]: ({ setContext, scope, context }) => (
  //   <MissionToolbar
  //     missionLabelFilter={getMissionFilter(context, scope)}
  //     setMissionFilter={setMissionFilter(setContext, scope)}
  //   />
  // ),
  // [WIDGET_TYPES_IDS.HISTORY]: ({ setContext, scope, context }) => (
  //   <LiveButtonToolbar
  //     startTs={getStartTime(context, scope)}
  //     setStartTime={setStartTime(setContext, scope)}
  //     timeRangeMs={getTimeRangeMs(context, scope)}
  //   />
  // ),
  // [WIDGET_TYPES_IDS.FLEET_STATUS]: () => <LiveButtonToolbar alwaysLive />,
  [WIDGET_TYPES_IDS.VITALS]: () => <LiveButtonToolbar alwaysLive />,
  // [WIDGET_TYPES_IDS.CAMERA]: () => <LiveButtonToolbar alwaysLive />,
  [WIDGET_TYPES_IDS.LIST_DATA]: () => <LiveButtonToolbar alwaysLive />,
  [WIDGET_TYPES_IDS.CUSTOM_DATA_IMAGE]: () => <LiveButtonToolbar alwaysLive />,
};

/**
 * Factory functions for Dashboard widgets. Factory functions are responsible
 * for properly connecting the widgets they create to a context. That means:
 *
 *   - Reading from the dashboard context to provide input properties to the widget
 *   - Passing callbacks mutating the dashboard context as required by the widget
 *
 *  All factory functions take an object holding the following properties:
 *   - config: widget configuration object (required)
 *   - context: Dashboard context providing input properties to the widget (required)
 *   - setContext: Context mutator function, taking the current context and returning a new one
 *   - scope: { read: string?, write: string? } optional obj for the widget's read and write scopes
 */
const WIDGET_FACTORY = {
  [WIDGET_TYPES_IDS.ROBOT_CONTROL_BAR]: ({ context, setContext, scope, switchTo }) => (
    <RobotControlBar
      selectRobotCallback={setRobotId(setContext, scope)}
      navigationDetailCallback={() => switchTo({ scope: CONTEXT_SLOTS.NAVIGATION })}
      robotId={getRobotId(context, scope)}
    />
  ),

  [WIDGET_TYPES_IDS.INCIDENT_LIST]: ({
    context, setContext, scope, switchTo, isZeroData
  }) => (
    <NowTimeContext.Consumer>
      {nowTs => (
        <IncidentList
          selectedIncident={getIncidentId(context, scope)}
          selectedComponentFilter={getIncidentComponent(context, scope)}
          selectedSeverityFilter={getIncidentSeverity(context, scope)}
          onSelectedIncidentChange={setIncidentId(setContext, scope)}
          robotId={getRobotId(context, scope)}
          selectStartTimeCallback={setStartTime(setContext, scope)}
          selectTimeRangeMsCallback={setTimeRangeMs(setContext, scope)}
          startTs={getStartTime(context, scope)}
          nowTs={nowTs}
          timeRangeMs={getTimeRangeMs(context, scope)}
          setTimeRangeMs={setTimeRangeMs(setContext, scope)}
          selectRobotCallback={setRobotId(setContext, scope)}
          onTimeFocusChange={setTimeFocus(setContext, scope)}
          switchTo={switchTo}
          isZeroData={isZeroData}
        />
      )}
    </NowTimeContext.Consumer>
  ),

  // [WIDGET_TYPES_IDS.INCIDENT_TIMELINE]: ({ setContext, context, scope, isZeroData }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <IncidentTimeline
  //         selectedIncident={getIncidentId(context, scope)}
  //         selectedComponentFilter={getIncidentComponent(context, scope)}
  //         selectedSeverityFilter={getIncidentSeverity(context, scope)}
  //         onSelectedIncidentChange={setIncidentId(setContext, scope)}
  //         robotId={getRobotId(context, scope)}
  //         startTs={getStartTime(context, scope)}
  //         nowTs={nowTs}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         setStartTime={setStartTime(setContext, scope)}
  //         setTimeRangeMs={setTimeRangeMs(setContext, scope)}
  //         isZeroData={isZeroData}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),

  // [WIDGET_TYPES_IDS.NAVIGATION]: ({ context, scope, setContext, isZeroData }) => (
  //   <NavigationDetailWithContext
  //     context={context}
  //     scope={scope}
  //     setContext={setContext}
  //     isZeroData={isZeroData}
  //   />
  // ),

  [WIDGET_TYPES_IDS.FLEET_STATUS]: ({
    config, context, setContext, scope
  }) => (
    <FleetStatusWidget
      robotId={getRobotId(context, scope)}
      onRobotSelected={setRobotId(setContext, scope)}
      sortBy={getFleetSortBy(context, scope)}
      groupBy={getFleetGroupBy(context, scope)}
      attributeStatus={getFleetAttributeStatus(context, scope)}
      robotStatus={getFleetRobotStatus(context, scope)}
      onRobotStatusSelected={setFleetRobotStatus(setContext, scope)}
      config={config}
    />
  ),

  // [WIDGET_TYPES_IDS.ROBOT_SEARCH]: ({
  //   config, context, setContext, scope, isZeroData
  // }) => (
  //   <RobotSearch
  //     selectedRobotId={getRobotId(context, scope)}
  //     selectRobotCallback={setRobotId(setContext, scope)}
  //     config={config}
  //     isZeroData={isZeroData}
  //   />
  // ),

  // [WIDGET_TYPES_IDS.FLEET_CONTROL]: ({ config, context, setContext, scope }) => (
  //   <FleetControlWidget
  //     config={config}
  //     sortBy={getFleetSortBy(context, scope)}
  //     onSortBySelected={setFleetSortBy(setContext, scope)}
  //     groupBy={getFleetGroupBy(context, scope)}
  //     onGroupBySelected={setFleetGroupBy(setContext, scope)}
  //     onShowSummaryView={setSummary(setContext, scope)}
  //     showSummaryView={getSummary(context, scope)}
  //     attributeStatus={getFleetAttributeStatus(context, scope)}
  //     onAttributeStatusSelected={setFleetAttributeStatus(setContext, scope)}
  //     robotStatus={getFleetRobotStatus(context, scope)}
  //     onRobotStatusSelected={setFleetRobotStatus(setContext, scope)}
  //     selectedRobotId={getRobotId(context, scope)}
  //     onRobotSelected={setRobotId(setContext, scope)}
  //   />
  // ),

  // [WIDGET_TYPES_IDS.IMAGE]: ({ config, isZeroData }) => (
  //   <ImageWidget
  //     config={config}
  //     isZeroData={isZeroData}
  //   />
  // ),

   [WIDGET_TYPES.LIST_DATA]: ({ config, context, scope }) => (
     <NowTimeContext.Consumer>
       {nowTs => (
         <ListData
           robotId={getRobotId(context, scope)}
           config={config}
           nowTs={nowTs}
         />
       )}
     </NowTimeContext.Consumer>
   ),

  // [WIDGET_TYPES_IDS.CHART]: ({ setContext, config, context, scope, isZeroData }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <TimelineWidget
  //         robotId={getRobotId(context, scope)}
  //         config={config}
  //         startTs={getStartTime(context, scope)}
  //         setStartTime={setStartTime(setContext, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         setTimeRangeMs={setTimeRangeMs(setContext, scope)}
  //         nowTs={nowTs}
  //         timeFocus={getTimeFocus(context, scope)}
  //         onTimeFocusChange={setTimeFocus(setContext, scope)}
  //         isZeroData={isZeroData}
  //         isPlaying={getIsPlaying(context, scope)}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),

  [WIDGET_TYPES.VITALS]: ({ config, context, scope, isZeroData }) => (
    <VitalsWidget
      robotId={getRobotId(context, scope)}
      config={config}
      isZeroData={isZeroData}
    />
  ),

  // [WIDGET_TYPES.LOCALIZATION]: ({
  //   context,
  //   scope,
  //   setContext,
  //   isZeroData,
  //   config
  // }) => (
  //   <LocalizationWidgetWithContext
  //     context={context}
  //     scope={scope}
  //     setContext={setContext}
  //     isZeroData={isZeroData}
  //     config={config}
  //   />
  // ),

  // [WIDGET_TYPES.ROS_DIAGNOSTICS]: ({ context, setContext, scope, isZeroData }) => (
  //   <DiagnosticsWidget
  //     robotId={getRobotId(context, scope)}
  //     selectedRosDiagnosticsLevel={getRosDiagnosticsLevel(context, scope)}
  //     setRosDiagnosticsLevel={setRosDiagnosticsLevel(setContext, scope)}
  //     isZeroData={isZeroData}
  //   />
  // ),

  // [WIDGET_TYPES.DATA_BAGS]: ({ context, scope, isZeroData }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <DataBagWidget
  //         robotId={getRobotId(context, scope)}
  //         filterStartTs={getStartTime(context, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         nowTs={nowTs}
  //         isZeroData={isZeroData}
  //         variant={DATA_BAG_VARIANT.DASHBOARD}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),

  [WIDGET_TYPES.KEY_VALUES]: ({ context, scope }) => (
      <NowTimeContext.Consumer>
      {nowTs => (
        <CustomDataWidget
          robotId={getRobotId(context, scope)}
          config={{ mapping: { source: 'key_value' } }}
          nowTs={nowTs}
        />
      )}
    </NowTimeContext.Consumer>
  ),

  // [WIDGET_TYPES_IDS.LOGS]: ({ context, setContext, scope, isZeroData }) => (
  //   <LogsWidget
  //     robotId={getRobotId(context, scope)}
  //     selectedVerbosityLevel={getVerbosityLevel(context, scope)}
  //     setVerbosityLevel={setVerbosityLevel(setContext, scope)}
  //     isZeroData={isZeroData}
  //   />
  // ),

  // [WIDGET_TYPES.CAMERA]: ({ config, context, scope, isZeroData }) => (
  //   <CameraView
  //     robotId={getRobotId(context, scope)}
  //     config={config}
  //     standalone
  //     isZeroData={isZeroData}
  //   />
  // ),

  // [WIDGET_TYPES.ACTIONS]: ({ config, context, scope, isZeroData }) => (
  //   <ActionsWidget
  //     robotId={getRobotId(context, scope)}
  //     config={config}
  //     isZeroData={isZeroData}
  //   />
  // ),

  // [WIDGET_TYPES_IDS.AUDIT_LOG]: ({ setContext, context, scope, isZeroData }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <AuditLogsRobot
  //         robotId={getRobotId(context, scope)}
  //         startTs={getStartTime(context, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         nowTs={nowTs}
  //         isZeroData={isZeroData}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),

  // [WIDGET_TYPES_IDS.AUDIT_LOG_FLEET]: ({ setContext, context, scope, isZeroData }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <AuditLogsFleet
  //         robotId={getRobotId(context, scope)}
  //         setRobotId={setRobotId(setContext, scope)}
  //         startTs={getStartTime(context, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         nowTs={nowTs}
  //         eventType={getEventType(context, scope)}
  //         setNewEventType={setEventType(setContext, scope)}
  //         eventModule={getEventModule(context, scope)}
  //         setEventModule={setEventModule(setContext, scope)}
  //         actionId={getActionId(context, scope)}
  //         setActionId={setActionId(setContext, scope)}
  //         setUserId={setUserId(setContext, scope)}
  //         userId={getUserId(context, scope)}
  //         isZeroData={isZeroData}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),

  [WIDGET_TYPES_IDS.CUSTOM_DATA_TEXT]: ({ config, context, scope }) => (
    <NowTimeContext.Consumer>
      {nowTs => (
        <CustomDataWidget
          robotId={getRobotId(context, scope)}
          config={config}
          nowTs={nowTs}
        />
      )}
    </NowTimeContext.Consumer>
  ),

  [WIDGET_TYPES_IDS.CUSTOM_DATA_IMAGE]: ({ config, context, scope }) => (
    <NowTimeContext.Consumer>
      {nowTs => (
        <CustomDataWidget
          robotId={getRobotId(context, scope)}
          config={config}
          nowTs={nowTs}
        />
      )}
    </NowTimeContext.Consumer>
  ),

  // [WIDGET_TYPES_IDS.NAVIGATION_CONTROL_BAR]: ({
  //   context, setContext, scope
  // }) => (
  //   <NavigationControlBar
  //     robotId={getRobotId(context, scope)}
  //     selectRobotCallback={setRobotId(setContext, scope)}
  //     mapLabel={getNavigationMap(context, scope)}
  //     setMapLabel={setNavigationMap(setContext, scope)}
  //   />
  // ),

  // [WIDGET_TYPES_IDS.MISSION_TRACKER]: ({
  //   context, setContext, scope, switchTo, isZeroData
  // }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <RobotMissionsTracker
  //         robotId={getRobotId(context, scope)}
  //         setRobotId={setRobotId(setContext, scope)}
  //         selectStartTimeCallback={setStartTime(setContext, scope)}
  //         selectTimeRangeMsCallback={setTimeRangeMs(setContext, scope)}
  //         onTimeFocusChange={setTimeFocus(setContext, scope)}
  //         missionLabelFilter={getMissionFilter(context, scope)}
  //         switchTo={switchTo}
  //         nowTs={nowTs}
  //         isZeroData={isZeroData}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),

  // [WIDGET_TYPES_IDS.FLEET_MISSION_TRACKER]: ({
  //   context, setContext, scope, switchTo, compad, isZeroData
  // }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <RobotMissionsTracker
  //         robotId={getRobotId(context, scope)}
  //         setRobotId={setRobotId(setContext, scope)}
  //         missionLabelFilter={getMissionFilter(context, scope)}
  //         selectStartTimeCallback={setStartTime(setContext, scope)}
  //         selectTimeRangeMsCallback={setTimeRangeMs(setContext, scope)}
  //         onTimeFocusChange={setTimeFocus(setContext, scope)}
  //         switchTo={switchTo}
  //         nowTs={nowTs}
  //         isZeroData={isZeroData}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),

  // [WIDGET_TYPES_IDS.MISSION_CONTROL_BAR]: ({
  // }) => (
  //   <MissionControlBarComponentWithMissionCtx
  //   />
  // ),

  // [WIDGET_TYPES_IDS.HISTORY]: ({ config, context, scope, isZeroData, setContext }) => (
  //   <NowTimeContext.Consumer>
  //     {nowTs => (
  //       <HistoryWidget
  //         config={config}
  //         robotId={getRobotId(context, scope)}
  //         isZeroData={isZeroData}
  //         nowTs={nowTs}
  //         startTs={getStartTime(context, scope)}
  //         timeRangeMs={getTimeRangeMs(context, scope)}
  //         timeFocus={getTimeFocus(context, scope)}
  //         onTimeFocusChange={setTimeFocus(setContext, scope)}
  //       />
  //     )}
  //   </NowTimeContext.Consumer>
  // ),
};
/* eslint-enable react/prop-types */
/* eslint-enable no-unused-vars */

const Dashboard = ({ dashboardSpec, context, setContext, switchTo }) => {
  /**
   * useEffect to read a robotId from localStorage
   *  - It will read read the robotId from localStorage only when there is no
   *    robotId in the context
   *  - It will validate that the robot from localStorage exists and can be accessed by
   *    the user with the method robot.canAccessRobot
   *  TODO: Validate the robot permissions when the id read from the context
   */
  useEffect(() => {
    // Get the robot id from context
    if (!getRobotId(context)) {
      // Get the robot id of the last selected robot from localStorage
      const storedRobotId = localStorage.getItem(CTX_PROPS.ROBOT_ID);
      // Verify that the user can access the robot
      Meteor.call('robot.canAccessRobot', { robotId: storedRobotId },
        (err) => {
          if (!err) {
            // Set the robot id stored in local storage only if the user
            // has permission for accessing the robot
            setRobotId(setContext)(storedRobotId);
          }
        });
    }
  }, [context]);

  return (
    <NowTimeProvider intervalMs={60000}>
      <DarkModeProvider>
        <FullscreenProvider>
          <DashboardComponent
            dashboardSpec={dashboardSpec}
            context={context}
            setContext={setContext}
            switchTo={switchTo}
            widgetFactory={WIDGET_FACTORY}
            toolbarFactory={TOOLBAR_FACTORY}
          />
        </FullscreenProvider>
      </DarkModeProvider>
    </NowTimeProvider>
  );
};

Dashboard.propTypes = {
  dashboardSpec: PropTypes.object.isRequired,
  context: PropTypes.object.isRequired,
  setContext: PropTypes.func.isRequired,
  switchTo: PropTypes.func.isRequired,
};

export default Dashboard;
