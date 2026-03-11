/**
 * IncidentTimeline (No Meteor)
 * Displays a timeline of incidents across robots in a fleet.
 * This component has no Meteor imports and can be rendered standalone.
 */
import React, { useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { throttle, isArray, isPlainObject } from 'lodash';
import { Typography, Grid } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import Timeline, { TimelineHeaders, DateHeader, SidebarHeader } from 'react-calendar-timeline';
import moment from 'moment';
import classnames from 'classnames';
import TimeIntervalHook from '../../util/timeUtils/TimeIntervalHook';
import { prepareTimeVarsForQuery, StartTsPropType } from '../../util/timeUtils';

const useStyles = makeStyles()(theme => ({
  calendarContainer: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%'
  },
  selected: {
    fontWeight: theme.fontWeight.bold,
    textDecoration: 'underline'
  },
  vertical: {
    borderLeft: `1px dashed ${theme.palette.background.gray} !important`,
    background: 'initial'
  },
  horizontalLine: {
    background: `${theme.palette.background.white} !important`,
    borderTop: `1px solid ${theme.palette.background.gray} !important`
  },
  horizontalDashedLine: {
    background: `${theme.palette.background.white} !important`,
    borderTop: `1px dashed ${theme.palette.background.gray} !important`
  },
  groupContainer: {
    background: '#F5F5F5',
    height: '100%'
  },
  incidentTitleContainer: {
    border: `1px solid ${theme.palette.background.gray}`,
    borderBottom: 'initial',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  robotNameContainer: {
    borderTop: `1px solid ${theme.palette.background.gray}`,
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  sideBarHeader: {
    display: 'flex',
    alignItems: 'center'
  },
  sideBarHeaderBorder: {
    borderRight: `1px solid ${theme.palette.background.gray}`,
    borderLeft: `1px solid ${theme.palette.background.gray}`
  },
  sideBarText: {
    fontWeight: theme.fontWeight.medium,
    fontSize: '13px',
    color: theme.palette.text.title,
    paddingLeft: '4px'
  },
  groupItemText: {
    fontWeight: theme.fontWeight.lightPlus,
    fontSize: '13px',
    color: theme.palette.text.content,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '25vw'
  },
  text: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryDateHeader: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: theme.palette.text.title,
    borderLeft: `1px solid ${theme.palette.background.gray}`,
    borderBottom: `1px solid ${theme.palette.background.gray}`
  },
  secondaryDateHeader: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: theme.palette.text.title,
    borderLeft: `1px solid ${theme.palette.background.gray}`
  },
  isSelectedIncident: {
    background: `${theme.palette.background.veryLightGray} !important`,
  }
}));

const IncidentTimelineWidget = ({
  selectedIncident,
  onSelectedIncidentChange,
  robotsMap,
  incidents,
  setStartTime,
  nowTs,
  startTs,
  timeRangeMs: propTimeRangeMs
}) => {
  const { classes, theme } = useStyles();

  const handleIncidentClicked = useCallback((incidentId) => {
    const nextSelected = selectedIncident === incidentId ? '' : incidentId;
    onSelectedIncidentChange(nextSelected);
  }, [selectedIncident, onSelectedIncidentChange]);

  // Build groups and items for react-calendar-timeline from incidents and robotsMap.
  // Groups: one row per robot+component pair. Items: one bar per incident.
  const { items, groups } = useMemo(() => {
    if (!isArray(incidents) || !isPlainObject(robotsMap)) {
      return { items: [], groups: [] };
    }

    const robotIncidents = {};
    const itemsAccumulator = [];

    incidents.forEach((incident) => {
      const componentId = (incident.componentsIds && incident.componentsIds[0]) || '';
      if (componentId.startsWith('RosDiag:')) {
        return; // skip noisy diagnostics
      }
      const robotId = incident.entityId;
      if (!robotIncidents[robotId]) {
        robotIncidents[robotId] = { robot: robotsMap[robotId], components: {} };
      }

      const name = componentId.indexOf('external:') > -1
        ? incident.label
        : incident.latestEvent && incident.latestEvent.name;

      if (!robotIncidents[robotId].components[componentId]) {
        robotIncidents[robotId].components[componentId] = { name };
      }

      if (selectedIncident === incident._id) {
        robotIncidents[robotId].components[componentId].isSelectedIncident = true;
      }

      itemsAccumulator.push({
        id: incident._id,
        start_time: incident.createdAt.getTime(),
        end_time: incident.resolvedAt?.getTime() || Date.now(),
        group: `${robotId}:${componentId}`,
        canMove: false,
        canResize: false,
        canChangeGroup: false,
        itemProps: {
          'data-id': incident._id,
          style: {
            background: theme.palette.severityColor[incident.highestSeverity || 'SEV 2'],
            borderRadius: '2px',
            border: 'initial'
          }
        }
      });
    });

    const groupsAccumulator = [];
    Object.keys(robotIncidents).forEach((robotId) => {
      let index = 0;
      Object.keys(robotIncidents[robotId].components).forEach((componentId) => {
        const componentData = robotIncidents[robotId].components[componentId];
        const name = componentData?.name || componentId;
        const robotName = index === 0
          && robotIncidents[robotId].robot
          && robotIncidents[robotId].robot.name;
        groupsAccumulator.push({
          id: `${robotId}:${componentId}`,
          title: name,
          robotName,
          isSelectedIncident: componentData.isSelectedIncident
        });
        index += 1;
      });
    });

    while (groupsAccumulator.length < 10) {
      groupsAccumulator.push({
        id: `ghost_line_${groupsAccumulator.length}`,
        title: '',
        robotName: ' ',
      });
    }

    return { items: itemsAccumulator, groups: groupsAccumulator };
  }, [incidents, robotsMap, selectedIncident]);

  const boundTimeValues = useCallback((start, end) => {
    const minTime = moment().add(-6, 'months').valueOf();
    const maxTime = moment().add(3, 'hours').valueOf();
    let boundedStart = start;
    let boundedEnd = end;
    if (start < minTime && end > maxTime) {
      boundedStart = minTime;
      boundedEnd = maxTime;
    } else if (start < minTime) {
      boundedStart = minTime;
      boundedEnd = minTime + (end - start);
    } else if (end > maxTime) {
      boundedStart = maxTime - (end - start);
      boundedEnd = maxTime;
    }
    return [Math.floor(boundedStart), Math.floor(boundedEnd)];
  }, []);

  const timeChangeHandler = useCallback((visibleTimeStart, visibleTimeEnd) => {
    const [boundedStart] = boundTimeValues(visibleTimeStart, visibleTimeEnd);
    setStartTime(boundedStart);
  }, [setStartTime, boundTimeValues]);

  // Throttle to prevent excessive calls during timeline drag
  // TODO: decouple internal scroll state from props to improve smoothness
  const throttledTimeHandler = useCallback(throttle(timeChangeHandler, 200), [timeChangeHandler]);

  useEffect(() => () => throttledTimeHandler.cancel(), [throttledTimeHandler]);

  const groupRenderer = useCallback(({ group }) => (
    <Grid container className={classes.groupContainer}>
      <Grid size={6} className={classes.robotNameContainer}>
        {group.robotName && (
          <Typography className={classes.groupItemText}>{group.robotName}</Typography>
        )}
      </Grid>
      <Grid
        size={6}
        className={classnames(classes.incidentTitleContainer, {
          [classes.isSelectedIncident]: group.isSelectedIncident
        })}
      >
        <Typography className={classes.groupItemText}>{group.title}</Typography>
      </Grid>
    </Grid>
  ), []);

  const getHorizontalLinesClassNames = useCallback((group) => {
    const lineClasses = [group.robotName ? classes.horizontalLine : classes.horizontalDashedLine];
    if (group.isSelectedIncident) {
      lineClasses.push(classes.isSelectedIncident);
    }
    return lineClasses;
  }, []);

  const getVerticalLineClassNames = useCallback(() => [classes.vertical], []);

  const itemRenderer = useCallback(({ item, itemContext, getItemProps }) => {
    const parsedItemProps = getItemProps(item.itemProps);
    const styleMerged = { ...parsedItemProps.style, ...item.itemProps.style };
    if (itemContext.selected) {
      styleMerged.border = '2px solid #2A3C98';
    }
    return (
      /* eslint-disable-next-line react/jsx-props-no-spreading */
      <div {...parsedItemProps} style={styleMerged}>
        <div
          className="rct-item-content"
          style={{ maxHeight: `${itemContext.dimensions.height}` }}
        >
          {itemContext.title}
        </div>
      </div>
    );
  }, []);

  const renderPrimaryHeader = useCallback(({ getIntervalProps, intervalContext }) => (
    /* eslint-disable-next-line react/jsx-props-no-spreading */
    <Typography {...getIntervalProps()} className={classes.primaryDateHeader} align="center">
      {intervalContext.intervalText}
    </Typography>
  ), []);

  const renderSecondaryHeader = useCallback(({ getIntervalProps, intervalContext }) => (
    /* eslint-disable-next-line react/jsx-props-no-spreading */
    <Typography {...getIntervalProps()} className={classes.secondaryDateHeader} align="center">
      {intervalContext.intervalText}
    </Typography>
  ), []);

  // Enforce a minimum time range to prevent react-calendar-timeline from crashing
  // See: https://github.com/namespace-ee/react-calendar-timeline/issues/707
  const timeRangeMs = propTimeRangeMs <= 90000 ? 90001 : propTimeRangeMs;
  const timeVars = prepareTimeVarsForQuery(startTs, timeRangeMs, nowTs);

  return (
    <div className={classes.calendarContainer}>
      <Timeline
        groups={groups}
        items={items}
        onItemSelect={handleIncidentClicked}
        onItemClick={handleIncidentClicked}
        defaultTimeStart={timeVars.startTs}
        defaultTimeEnd={timeVars.endTs}
        visibleTimeStart={timeVars.startTs}
        visibleTimeEnd={timeVars.endTs}
        onTimeChange={throttledTimeHandler}
        selected={[selectedIncident]}
        groupRenderer={groupRenderer}
        sidebarWidth={300}
        verticalLineClassNamesForTime={getVerticalLineClassNames}
        horizontalLineClassNamesForGroup={getHorizontalLinesClassNames}
        itemHeightRatio={0.3}
        lineHeight={32}
        itemRenderer={itemRenderer}
      >
        <TimelineHeaders style={{ background: 'transparent', border: 0 }}>
          <SidebarHeader>
            {({ getRootProps }) => (
              /* eslint-disable-next-line react/jsx-props-no-spreading */
              <Grid container {...getRootProps()}>
                <Grid className={classes.sideBarHeader} size={6}>
                  <Typography className={classes.sideBarText}>Robot</Typography>
                </Grid>
                <Grid className={classnames(classes.sideBarHeader, classes.sideBarHeaderBorder)} size={6}>
                  <Typography className={classes.sideBarText}>Incident</Typography>
                </Grid>
              </Grid>
            )}
          </SidebarHeader>
          <DateHeader unit="primaryHeader" intervalRenderer={renderPrimaryHeader} />
          <DateHeader intervalRenderer={renderSecondaryHeader} />
        </TimelineHeaders>
      </Timeline>
    </div>
  );
};

IncidentTimelineWidget.propTypes = {
  incidents: PropTypes.array,
  robotsMap: PropTypes.object,
  selectedIncident: PropTypes.string,
  onSelectedIncidentChange: PropTypes.func,
  setStartTime: PropTypes.func,
  startTs: StartTsPropType,
  nowTs: PropTypes.number,
  timeRangeMs: PropTypes.number
};

// Wraps IncidentTimelineWidget in TimeIntervalHook to provide period/page controls
const IncidentTimelineComponent = (props) => (
  <TimeIntervalHook
    render={renderProps => <IncidentTimelineWidget {...renderProps} />}
    {...props}
  />
);

export default IncidentTimelineComponent;
