/**
 * Custom Data widget
 * allows displaying custom key value pairs reported by the agent
 * Used by:
 *  - Custom Image widget
 *  - Log files widget
 *  - Key-value Sources widget
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { isString, sortBy, isEmpty } from 'lodash';
import moment from 'moment';
import classNames from 'classnames';
import {
  Typography,
  Grid,
  Table,
  TableHead,
  TableSortLabel,
  Divider
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import { SOURCES, AttributeValueFormatter } from '../../../../shared/attributes';
import { UNDEFINED_VALUE } from '../../../../lib/util';
import { StyledTableBody, StyledTableCell, StyledTableContainer, StyledTableRow } from '../../util/DefaultTable';
import NoDataIcon from '../../graphics/op/NoDataIcon';

// Maximum age [milliseconds] a custom data can have before it can be considered stale
const MAX_DATA_AGE = 1000 * 60 * 5;
const DATA_TYPE_KV = 'key_value';
const KV_RECENT_TIME = moment.duration(1, 'minutes').valueOf();
const TAIL_READ_ORDER = 'tail';

const formatter = AttributeValueFormatter(null);

const useStyles = makeStyles()(theme => ({
  container: {
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  customList: {
    maxHeight: '100%',
    overflow: 'auto',
  },
  textArea: {
    fontSize: '0.8125rem',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    height: '100%',
  },
  textAreaNoWrap: {
    fontSize: '0.8125rem',
    overflowWrap: 'break-word',
    whiteSpace: 'pre',
    height: '100%',
  },
  imageArea: {
    justifyContent: 'center',
    alignItems: 'center',
    display: 'flex',
    height: '100%',
  },
  widgetLabel: {
    fontWeight: theme.fontWeight.medium,
    padding: '0.5em 0',
    display: 'inline',
  },
  widgetToolbar: {
    zIndex: 1,
    display: 'flex',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '3em',
    backgroundImage: 'linear-gradient(rgb(255,255,255,100), rgba(0,0,0,0))',
  },
  text: {
    position: 'absolute',
    fontSize: '1.25rem',
    fontWeight: theme.fontWeight.bold,
  },
  outdatedMessage: {
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    fontSize: '1.25rem',
    fontWeight: theme.fontWeight.bold,
  },
  fileIsTooLargeMsg: {
    fontSize: '0.8125rem',
    color: theme.palette.text.title,
    fontWeight: theme.fontWeight.medium,
    lineHeight: '15.23px',
    margin: 0
  },
  fileIsTooLargeContainer: {
    padding: '3px 10px 10px'
  },
  textContainer: {
    padding: '10px'
  },
  arrowIcon: {
    color: theme.palette.text.title,
    fontSize: '0.875rem',
  },
  staleValue: {
    color: theme.palette.incidents.inactive,
  },
  textValueUndefined: {
    padding: theme.spacing(1),
    verticalAlign: 'top',
    color: theme.palette.text.statusError,
  }
}));

const CustomDataWidgetComponent = ({
  customData,
  dataType,
  config = {},
  staleIndicator = true,
  label = '',
  maximized = false,
  variant = 'GCWidget',
}) => {
  const { classes } = useStyles();
  const [sortKey, setSortKey] = useState('key'); // 'key' or 'ts'
  const [sortAsc, setSortAsc] = useState(true);
  const scrollableLogsText = useRef(null);
  const prevTextRef = useRef(null);
  // Used both as current timestamp for stale checks and to trigger re-renders
  const [now, setNow] = useState(Date.now());

  // Re-render after MAX_DATA_AGE to update stale indicators
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), MAX_DATA_AGE);
    return () => clearTimeout(timer);
  }, [customData, now]);

  // Auto-scroll for text mode in tail read order
  useEffect(() => {
    if (dataType !== SOURCES.FILE_TEXT.value || config.readOrder !== TAIL_READ_ORDER) return;
    const curText = customData?.text;
    if (prevTextRef.current !== curText && scrollableLogsText.current) {
      scrollableLogsText.current.scrollTo(0, scrollableLogsText.current.scrollHeight);
    }
    prevTextRef.current = curText;
  }, [customData, dataType, config.readOrder]);

  const sortedData = useMemo(() => {
    if (!Array.isArray(customData) || isEmpty(customData)) return customData;
    // customData is already sorted alphabetically by key from the hook
    const sorted = sortKey === 'ts' ? sortBy(customData, 'ts') : [...customData];
    return sortAsc ? sorted : [...sorted].reverse();
  }, [customData, sortKey, sortAsc]);

  const handleClickDataSource = () => {
    setSortKey('key');
    setSortAsc(prev => !prev);
  };

  const handleClickLastUpdate = () => {
    setSortKey('ts');
    setSortAsc(prev => !prev);
  };

  const renderKeyValuePairs = () => {
    if (isEmpty(sortedData)) {
      return <NoDataIcon />;
    }
    return sortedData.map((kv) => {
      let { ts } = kv;
      const value = kv.value !== undefined ? formatter(kv.value) : UNDEFINED_VALUE;
      // HACK: Timestamps may come a few secs/mins in the future due to clock differences.
      if (ts > now) {
        ts = now;
      }
      const isStale = staleIndicator && now - kv.ts > MAX_DATA_AGE;
      return (
        <StyledTableRow
          data-test="mc-keyvalue-widget-tablerow"
          key={kv.key}
          className={isStale ? classes.staleValue : null}
        >
          <StyledTableCell
            data-test="mc-keyvalue-widget-tablekey"
            width="30%"
            className={classNames({ [classes.textValueUndefined]: value === UNDEFINED_VALUE })}
          >
            {kv.key}
          </StyledTableCell>
          <StyledTableCell
            data-test="mc-keyvalue-widget-tablevalue"
            width="30%"
            className={classNames({ [classes.textValueUndefined]: value === UNDEFINED_VALUE })}
          >
            {value}
          </StyledTableCell>
          <StyledTableCell
            width="30%"
            className={classNames({ [classes.textValueUndefined]: value === UNDEFINED_VALUE })}
          >
            {ts > now - KV_RECENT_TIME ? 'recently' : moment(ts).from(now)}
          </StyledTableCell>
        </StyledTableRow>
      );
    });
  };

  const renderLabel = () => {
    const cameraLabel = label || (customData && customData.customField);
    return (
      <Grid
        container
        className={classes.widgetToolbar}
        justifyContent={maximized ? 'center' : 'flex-start'}
      >
        <Typography
          variant="subtitle1"
          className={classes.widgetLabel}
          style={cameraLabel ? { padding: '10px' } : {}}
        >
          {cameraLabel}
        </Typography>
      </Grid>
    );
  };

  const renderImage = () => {
    const isStale = staleIndicator && now - customData.ts > MAX_DATA_AGE;
    return customData._image ? (
      <div className={classes.imageArea}>
        <img
          src={'data:image/jpeg;base64,' + customData._image}
          style={{
            opacity: isStale ? '0.5' : 1,
            maxHeight: '100%',
            maxWidth: '100%',
            width: 'auto',
            height: 'auto',
            zoom: 100,
            objectFit: 'contain',
          }}
          alt=""
        />
        {isStale && (
          <Typography variant="subtitle1" className={classes.text}>
            {`No new image received since ${moment(customData.ts).fromNow()}`}
          </Typography>
        )}
      </div>
    ) : (
      <div className={classes.imageArea}>
        <NoDataIcon />
      </div>
    );
  };

  const renderText = () => {
    const { details } = customData;

    const fileIsTooLargeMsg = (
      <Typography
        align="center"
        variant="caption"
        color="textSecondary"
        gutterBottom
        className={classes.fileIsTooLargeMsg}
      >
        File is too large. Contents skipped.
      </Typography>
    );

    let isBOFCropped = false;
    let isEOFCropped = false;

    if (details && ['blobOffset', 'blobSize', 'totalFileSize'].every(key => Object.keys(details).includes(key))) {
      const { blobOffset, blobSize, totalFileSize } = details;
      isBOFCropped = blobOffset > 0;
      isEOFCropped = blobSize + blobOffset < totalFileSize;
    }
    return (
      <Grid container className={classes.container}>
        <Grid item xs={12} className={classes.customList} ref={scrollableLogsText}>
          <Grid item xs={12} className={classes.fileIsTooLargeContainer}>
            {isBOFCropped && fileIsTooLargeMsg}
          </Grid>
          <Divider />
          <Grid item xs={12} className={classes.textContainer}>
            <Typography
              className={classNames(
                [classes.textArea],
                { [classes.textAreaNoWrap]: config.nowrap }
              )}
            >
              {customData.text}
            </Typography>
          </Grid>
          <Grid item xs={12} className={classes.fileIsTooLargeContainer}>
            {isEOFCropped && fileIsTooLargeMsg}
          </Grid>
        </Grid>
      </Grid>
    );
  };

  const direction = sortAsc ? 'asc' : 'desc';

  if (dataType === DATA_TYPE_KV) {
    return (
      <StyledTableContainer data-test="mc-keyvalue-widget">
        <Table stickyHeader element="table" aria-label="sticky table" size="small">
          <TableHead>
            <StyledTableRow>
              <StyledTableCell width="30%">
                <TableSortLabel
                  onClick={handleClickDataSource}
                  direction={direction}
                  classes={{ icon: classes.arrowIcon }}
                >
                  Data Source
                </TableSortLabel>
              </StyledTableCell>
              <StyledTableCell width="30%">
                Value
              </StyledTableCell>
              <StyledTableCell
                width="30%"
                onClick={handleClickLastUpdate}
                direction={direction}
              >
                <TableSortLabel
                  onClick={handleClickLastUpdate}
                  direction={direction}
                  classes={{ icon: classes.arrowIcon }}
                >
                  Last Update
                </TableSortLabel>
              </StyledTableCell>
            </StyledTableRow>
          </TableHead>
          <StyledTableBody>
            {renderKeyValuePairs()}
          </StyledTableBody>
        </Table>
      </StyledTableContainer>
    );
  } else if (dataType == SOURCES.FILE_TEXT.value) {
    return renderText();
  } else if (dataType == SOURCES.FILE_IMAGE.value) {
    return (
      <div className={classes.container}>
        {variant === 'MOWidget' && renderLabel()}
        {renderImage()}
      </div>
    );
  } else {
    return (
      <Typography className={classes.textArea}>
        {`The provided format is unsupported: ${dataType}`}
      </Typography>
    );
  }
};

CustomDataWidgetComponent.propTypes = {
  customData: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  dataType: PropTypes.string,
  config: PropTypes.shape({
    readOrder: PropTypes.string,
    nowrap: PropTypes.bool,
  }),
  staleIndicator: PropTypes.bool,
  label: PropTypes.string,
  maximized: PropTypes.bool,
  variant: PropTypes.oneOf(['GCWidget', 'MOWidget']),
};

export default CustomDataWidgetComponent;

export { DATA_TYPE_KV };
