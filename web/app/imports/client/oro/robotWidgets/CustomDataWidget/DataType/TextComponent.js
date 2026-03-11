/**
 * Text Component
 * displays text data
 * Used by:
 *  - Custom Text widget
 */
import React, { useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Grid, Typography, Divider } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const TAIL_READ_ORDER = 'tail';
const DETAILS_KEYS = ['blobOffset', 'blobSize', 'totalFileSize'];

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
  fileIsTooLargeMsg: {
    fontSize: '0.8125rem',
    color: theme.palette.text.title,
    fontWeight: theme.fontWeight.medium,
    lineHeight: '15.23px',
    margin: 0,
  },
  fileIsTooLargeContainer: {
    padding: '3px 10px 10px',
  },
  textContainer: {
    padding: '10px',
  },
}));

const TextComponent = ({ customData, config }) => {
  const { classes } = useStyles();
  const scrollableRef = useRef(null);
  const prevTextRef = useRef(null);

  // DOM side effect: auto-scroll to bottom when new text arrives in tail read mode
  useEffect(() => {
    if (config?.readOrder !== TAIL_READ_ORDER) return;
    const curText = customData?.text;
    if (prevTextRef.current !== curText && scrollableRef.current) {
      scrollableRef.current.scrollTo(0, scrollableRef.current.scrollHeight);
    }
    prevTextRef.current = curText;
  }, [customData, config?.readOrder]);

  const { isBOFCropped, isEOFCropped } = useMemo(() => {
    const { details } = customData || {};
    if (details && DETAILS_KEYS.every(key => key in details)) {
      const { blobOffset, blobSize, totalFileSize } = details;
      return {
        isBOFCropped: blobOffset > 0,
        isEOFCropped: blobSize + blobOffset < totalFileSize,
      };
    }
    return { isBOFCropped: false, isEOFCropped: false };
  }, [customData?.details]);

  return (
    <Grid container className={classes.container}>
      <Grid xs={12} className={classes.customList} ref={scrollableRef}>
        <Grid xs={12} className={classes.fileIsTooLargeContainer}>
          {isBOFCropped && (
            <Typography
              align="center"
              variant="caption"
              color="textSecondary"
              gutterBottom
              className={classes.fileIsTooLargeMsg}
            >
              File is too large. Contents skipped.
            </Typography>
          )}
        </Grid>
        <Divider />
        <Grid xs={12} className={classes.textContainer}>
          <Typography
            className={classNames(
              [classes.textArea],
              { [classes.textAreaNoWrap]: config?.nowrap }
            )}
          >
            {customData?.text}
          </Typography>
        </Grid>
        <Grid xs={12} className={classes.fileIsTooLargeContainer}>
          {isEOFCropped && (
            <Typography
              align="center"
              variant="caption"
              color="textSecondary"
              gutterBottom
              className={classes.fileIsTooLargeMsg}
            >
              File is too large. Contents skipped.
            </Typography>
          )}
        </Grid>
      </Grid>
    </Grid>
  );
};

TextComponent.propTypes = {
  customData: PropTypes.shape({
    text: PropTypes.string,
    details: PropTypes.shape({
      blobOffset: PropTypes.number,
      blobSize: PropTypes.number,
      totalFileSize: PropTypes.number,
    }),
  }),
  config: PropTypes.shape({
    readOrder: PropTypes.string,
    nowrap: PropTypes.bool,
  }),
};

export default TextComponent;
