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
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Grid, Typography, CircularProgress } from '@mui/material';
import Plotly from 'plotly.js-basic-dist';
import { makeStyles } from 'tss-react/mui';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { isEmpty } from 'lodash';
// Read more here: https://github.com/plotly/react-plotly.js/#customizing-the-plotlyjs-bundle
import createPlotlyComponent from 'react-plotly.js/factory';

const useStyles = makeStyles()((theme) => ({
  container: {
    position: 'relative',
    height: '100%',
    width: '100%'
  },
  plot: {
    height: '100%',
    width: '100%'
  },
  loading: {
    position: 'absolute',
    right: '20px',
    bottom: '20px',
    zIndex: 1,
    '& svg': { // hack to colorize CircularProgress
      color: theme.palette.text.secondary,
      opacity: 0.7,
    }
  },
  fadeOut: {
    opacity: 0.3
  },
  error: {
    opacity: 1
  },
}));

// This config object removes the Plotly logo and link to
// Plotly online editor from the Graph Component.
const plotlyConfig = {
  displaylogo: false,
  modeBarButtonsToRemove: ['sendDataToCloud'],
  displayModeBar: false 
};

const PLOTLY_LINE_FORMATS = {
  linechart: {
    type: 'scatter',
    fill: 'none'
  },
  areachart:  {
    type: 'scatter',
    fill: 'tonexty',
  }
};
const DEFAULT_LINE_FORMAT = {
  type: 'scatter', 
  fill: 'none'
};

/**
 * Parses the format required for chart types.
 * The chart type is given by widgetConfig.type.
 */
const getLineFormat = (lineType) => {
  return PLOTLY_LINE_FORMATS[lineType] || DEFAULT_LINE_FORMAT;
};


// customizable method: use your own `Plotly` object
const Plot = createPlotlyComponent(Plotly);

const TimelineComponent = ({ 
  // Wrapper widget props
  dataQuery, 
  data, 
  error,
  onChangeLayout,
  // Dashboard props
  timeFocus,
  onTimeFocusChange,
  config: widgetConfig,
  isLoading
}) => {
  const { classes, theme } = useStyles();
  const [range, setRange] = React.useState({
    xRangeStart: null,
    xRangeEnd: null,
    yRangeStart: null,
    yRangeEnd: null
  });
  const [parsedData, setParsedData] = useState();
  const [timelineErrorMessage, setTimelineErrorMessage] = useState();

  React.useEffect(() => {
    setRange({
      xRangeStart: dataQuery?.startTs,
      xRangeEnd: dataQuery?.endTs,
      yRangeStart: null,
      yRangeEnd: null
    });
  }, [dataQuery]);

  /**
   * Executes after the user changes time range by zooming in, zooming out or panning
   * @param {object} event - react-plotly.js object
   *  event: {
   *    'xaxis.range[0]': string with x axis start date
   *    'xaxis.range[1]': string with x axis end date
   *    'yaxis.range[0]': number with y axis min value
   *    'yaxis.range[1]': number with y axis max value
   * }
   */
  const handleRelayout = useCallback((event) => {
    let newRange = { ...range };
    if ('xaxis.autorange' in event) {
      newRange.xRangeStart = undefined;
      newRange.xRangeEnd = undefined;
    }
    if ('xaxis.range[0]' in event) {
      newRange.xRangeStart = event['xaxis.range[0]'];
    }
    if ('xaxis.range[1]' in event) {
      newRange.xRangeEnd = event['xaxis.range[1]'];
    }

    if ('yaxis.autorange' in event) {
      newRange.yRangeStart = undefined;
      newRange.yRangeEnd = undefined;
    }
    if ('yaxis.range[0]' in event) {
      newRange.yRangeStart = event['yaxis.range[0]'];
    }
    if ('yaxis.range[1]' in event) {
      newRange.yRangeEnd = event['yaxis.range[1]'];
    }
    setRange(newRange);
    // Call onChangleLayout callback only when theres been a change in the plot ranges
    // the change must exist in the xaxis or the yaxis
    if (event && onChangeLayout
      && ((event['xaxis.range[0]'] && event['xaxis.range[1]'])
        || (event['yaxis.range[0]'] && event['yaxis.range[1]']))
    ) {
      onChangeLayout({
        newXStart: event['xaxis.range[0]'],
        newXEnd: event['xaxis.range[1]'],
        newYMin: event['yaxis.range[0]'],
        newYMax: event['yaxis.range[1]']
      });
    }
  }, [range, onChangeLayout]);


  const handleHover = useCallback((event) => {
    const point = event.points[0]?.data.x[event.points[0].pointIndex];
    const time = point.getTime && point.getTime();
    if (time && onTimeFocusChange) {
      onTimeFocusChange(time);
    }
  }, [onTimeFocusChange]);



  const layout = useMemo(() => {
    const { xRangeStart, xRangeEnd, yRangeStart, yRangeEnd } = range;
    // Get the range start and end from the props or the query params
    // If the range start and end are not defined, use the query params
    // the idea is to avoid NaN dates
    const rangeStartRaw = xRangeStart || dataQuery?.startTs;
    const rangeEndRaw = xRangeEnd || dataQuery?.endTs;

    let rangeStartDate = null;
    if (rangeStartRaw !== undefined && rangeStartRaw !== null) {
      const parsedStart = new Date(rangeStartRaw);
      if (!Number.isNaN(parsedStart.getTime())) {
        rangeStartDate = parsedStart;
      }
    }

    let rangeEndDate = null;
    if (rangeEndRaw !== undefined && rangeEndRaw !== null) {
      const parsedEnd = new Date(rangeEndRaw);
      if (!Number.isNaN(parsedEnd.getTime())) {
        rangeEndDate = parsedEnd;
      }
    }

    const yaxis = {
      showgrid: true
    };

    if (yRangeStart && yRangeEnd) {
      yaxis.range = [yRangeStart, yRangeEnd];
    } else if ('min' in widgetConfig && 'max' in widgetConfig && widgetConfig.min < widgetConfig.max) {
      // if there is a fixed range (say, [0..100]) and values lie on one limit (e.g.
      // a constant ==100 line), the lines render too thin. To avoid that common
      // situation, add 'just a bit' of extra range (1%) above and below the specified range.
      const delta = widgetConfig.max - widgetConfig.min;
      yaxis.range = [widgetConfig.min - (delta / 100), widgetConfig.max + (delta / 100)];
    }

    const layout = {
      autosize: true,
      title: widgetConfig.title || null,
      margin: {
        l: 30,
        r: 0,
        b: 50,
        t: 20,
      },
      font: {
        color: theme.palette.text.secondary // applies to most fonts: axes, legends
      },
      plot_bgcolor: theme.palette.background.paper,
      paper_bgcolor: theme.palette.background.paper,
      xaxis: {
        showgrid: true,
        gridcolor: theme.palette.background.gray,
        zeroline: true,
        zerolinecolor: theme.palette.background.gray
      },
      yaxis: {
        showgrid: true,
        gridcolor: theme.palette.background.gray,
        zeroline: true,
        zerolinecolor: theme.palette.background.gray
      },
      legend: {
        itemsizing: 'constant'
      },
      modebar: {
        orientation: 'v',
        bgcolor: theme.palette.background.paper, 
      },
      hoverlabel: {
        bordercolor: 'transparent',
        font: {
          color: theme.palette.text.primary
        }
      },
      shapes: [], // vertical "timeFocus" bar or mode segments are added here
      annotations: [] // annotations for labels
    };

    if (timeFocus) {
      // Draw a vertical line at the selected time
      layout.shapes.push({
        type: 'line',
        x0: timeFocus,
        x1: timeFocus,
        y0: 0.01,
        y1: 1,
        xref: 'x',
        yref: 'paper',
        opacity: 0.5,
        line: {
          width: 2,
          color: 'gray'
        }
      });
    }

    // If there is 'segments' data (normally modes), render them
    // const { segments, segmentsPalette } = {}; // FIXME re-add segments
    // if (isEmpty(segments) && rangeStartDate && rangeEndDate) {
    //   layout.shapes.push({
    //     layer: 'below',
    //     type: 'rect',
    //     xref: 'x',
    //     yref: 'paper',
    //     x0: rangeStartDate,
    //     x1: rangeEndDate,
    //     y0: -0.12,
    //     y1: -0.2,
    //     fillcolor: 'gray',
    //     opacity: 1,
    //     line: {
    //       width: 0,
    //     }
    //   });
    //   const startTimeMs = rangeStartDate.getTime();
    //   const endTimeMs = rangeEndDate.getTime();
    //   const midTime = new Date((startTimeMs + endTimeMs) / 2);
    //   layout.annotations.push({
    //     x: midTime,
    //     y: -0.18,
    //     xref: 'x',
    //     yref: 'paper',
    //     text: 'Zoom in to get more data',
    //     showarrow: false,
    //     font: {
    //       size: 11,
    //       color: 'white'
    //     },
    //     align: 'center'
    //   });
    // }
    // if (segments?.length && segmentsPalette) {
    //   segments.forEach((segment) => {
    //     const { startTime, endTime, tagId } = segment;
    //     // If the tagId is null, we are rendering a gray segment with a label
    //     // to indicate that the data is not available.
    //     if (tagId === null) {
    //       layout.shapes.push({
    //         layer: 'below',
    //         type: 'rect',
    //         xref: 'x',
    //         yref: 'paper',
    //         x0: new Date(startTime),
    //         x1: new Date(endTime),
    //         y0: -0.12,
    //         y1: -0.2,
    //         fillcolor: 'gray',
    //         opacity: 1,
    //         line: {
    //           width: 0,
    //         }
    //       });
    //       const startTimeMs = new Date(startTime).getTime();
    //       const endTimeMs = new Date(endTime).getTime();
    //       const midTime = new Date((startTimeMs + endTimeMs) / 2);
    //       layout.annotations.push({
    //         x: midTime,
    //         y: -0.18,
    //         xref: 'x',
    //         yref: 'paper',
    //         text: 'No data to show',
    //         showarrow: false,
    //         font: {
    //           size: 11,
    //           color: 'white'
    //         },
    //         align: 'center'
    //       });
    //     } else {
    //       // If the tagId is not null, we are rendering the segment
    //       // as a rectangle with the color of the tag.
    //       layout.shapes.push({
    //         layer: 'below',
    //         type: 'rect',
    //         xref: 'x',
    //         yref: 'paper',
    //         x0: new Date(startTime),
    //         x1: new Date(endTime),
    //         y0: -0.12,
    //         y1: -0.2,
    //         fillcolor: segmentsPalette.getColor(tagId),
    //         opacity: 1,
    //         line: {
    //           width: 0,
    //         }
    //       });
    //     }
    //   });
    // }

    if (rangeStartDate && rangeEndDate) {
      layout.xaxis.range = [rangeStartDate, rangeEndDate];
    }

    return layout;
  }, [dataQuery, data, timeFocus, range]);


  /**
   * This method parses data received from the TimeSeriesQuery HOC to
   * a series object which plotly.js can parse and graph.
   */
  useEffect(() => {
    const dataToParse = data;

    if (!dataToParse) {
      return;
    }
    setTimelineErrorMessage(null);

    const applyUnit = (cfg, value) => {
      if (cfg && 'scale' in cfg && value !== null) {
        return value * cfg.scale;
      }
      return value;
    };

    // If there is an error, set the error message and return to
    // avoid rendering the chart.
    if (dataToParse.error) {
      setTimelineErrorMessage(dataToParse.error);
      return null;
    }

    const lineFormat = getLineFormat(widgetConfig?.chartType);
    const series = dataQuery?.attributeIds.map((field, index) => {
      const fieldConfig = widgetConfig.elementValues[field];
      // Default hover labels with 2 decimal places, unless 'precision'
      // is in the field's config.
      let hovertemplate = '%{y:.2f}';
      if (fieldConfig) {
        if ('precision' in fieldConfig) {
          hovertemplate = `%{y:.${fieldConfig.precision}f}`;
        }
        // If a unit is also provided ("m", "%"), append it to hover template
        if ('unit' in fieldConfig) {
          hovertemplate += fieldConfig.unit;
        }
      }
      return {
        // By adding new Date(...) to the x portion of the data series,
        // we are using the current browser's timezone to parse the dates.
        x: dataToParse.values.map(e => new Date(e[0])),
        y: dataToParse.values.map(e => applyUnit(fieldConfig, e[index + 1])),
        name: fieldConfig.label,
        hovertemplate,
        type: lineFormat?.type,
        fill: lineFormat?.fill,
        line: {
          width: 1.5,
        }
      };
    });

    // Add more (fake) series for the segments (if segments are defined) so that they are
    // included in the legend rendered by plotly
    // const { segments, segmentsPalette } = {}; // FIXME re-enable mode segments;
    // if (segments?.length && segmentsPalette && series[0]?.x[0]) {
    //   const colorsShown = new Set();
    //   segments && segments.forEach((seg) => {
    //     const { tagId } = seg;
    //     if (tagId === null) {
    //       return;
    //     }
    //     if (!colorsShown.has(tagId)) {
    //       colorsShown.add(tagId);
    //       series.push({
    //         x: [series[0].x[0]], // data is irrelevant, as long as it fix in current timeframe
    //         y: [series[0].y[0]],
    //         marker: {
    //           color: segmentsPalette.getColor(tagId),
    //           line: { color: 'transparent' }
    //         },
    //         type: 'bar', // no data; just to show the legend marker as a square by default
    //         name: segmentsPalette.getLabel(tagId),
    //         legendgroup: 'segments' // any string to separate them from the main labels group
    //       });
    //     }
    //   });
    // }
    setParsedData(series);
  }, [data, dataQuery, widgetConfig]);

  const showError = error?.name && error?.message;
  if (timelineErrorMessage) {
    return (
      <Grid
        container
        item
        xs
        justifyContent="center"
        alignItems="center"
        className={isLoading ? classes.fadeOut : classes.error}
      >
        <Typography variant="h5">
          {timelineErrorMessage}
        </Typography>
      </Grid>
    );
  }

  return (
    <div className={classes.container}>
      {isLoading && (
        <Grid item xs className={classes.loading}>
          <CircularProgress size="20px" />
        </Grid>
      )}
      { showError && (
        <Grid
          container
          item
          xs
          justifyContent="center"
          alignItems="center"
          className={isLoading ? classes.fadeOut : classes.error}
        >
          <Typography variant="h5">
            {error.message}
          </Typography>
        </Grid>
      )}
      { !showError && (
        <Plot
          data={parsedData}
          layout={layout}
          className={
            classNames(
              classes.plot,
              isLoading && classes.fadeOut,
            )
          }
          config={plotlyConfig}
          useResizeHandler
          onRelayout={handleRelayout}
          onHover={handleHover}
        />
      )}
    </div>
  );
};

TimelineComponent.propTypes = {
  isLoading: PropTypes.bool,
  error: PropTypes.object,
  // the dashboard widget config. Used for labels, min/max, etc. Some fields will be redundant (e.g. parsed into dataQuery)
  config: PropTypes.object, 
  // the query prepared to get data. It contains the actual attributeIds we are displaying
  dataQuery: PropTypes.shape({
    // attributes, xMin, xMax ...
    attributeIds: PropTypes.array,
    aggregations: PropTypes.array,
  }),
  // the data retrieved
  data: PropTypes.shape({
    columns: PropTypes.array,
    values: PropTypes.arrayOf(PropTypes.array)
  }),
  // Draw a vertical line at timeFocus
  timeFocus: PropTypes.number,
  // Callback executes when Plot has a change in the X axis (time)
  onChangeLayout: PropTypes.func,
  // Callback to execute when the user hovers a data point. The callback will
  // receive the point's time
  onTimeFocusChange: PropTypes.func,
  // FIXME/re-add this. segments (each with startDate, endDate) to draw under the timeline chart
  // segments: PropTypes.array,
  // FIXME/re-add this. Palette used for segments to be drawn as time intervals under the chart (normally: modes)
  // segmentsPalette: PropTypes.object
};


export default TimelineComponent;