/**
 * Image Component
 * displays image data
 * Used by:
 *  - Custom Image widget (Custom Data widget)
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Typography, Grid } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import NoDataIcon from '../../../graphics/op/NoDataIcon';

const MAX_DATA_AGE = 1000 * 60 * 5;

const useStyles = makeStyles()(theme => ({
  container: {
    position: 'relative',
    height: '100%',
    width: '100%',
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
  staleText: {
    position: 'absolute',
    fontSize: '1.25rem',
    fontWeight: theme.fontWeight.bold,
  },
}));

const ImageComponent = ({
  customData,
  label = '',
  maximized = false,
  staleIndicator = true,
  now,
  variant = 'GCWidget',
}) => {
  const { classes } = useStyles();

  const cameraLabel = useMemo(() => label || customData?.customField, [label, customData?.customField]);

  const labelContent = useMemo(() => (
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
  ), [cameraLabel, maximized]);

  const imageContent = useMemo(() => {
    if (!customData?._image) {
      return (
        <div className={classes.imageArea}>
          <NoDataIcon />
        </div>
      );
    }
    const isStale = staleIndicator && now - customData.ts > MAX_DATA_AGE;
    return (
      <div className={classes.imageArea}>
        <img
          src={`data:image/jpeg;base64,${customData._image}`}
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
          <Typography variant="subtitle1" className={classes.staleText}>
            {`No new image received since ${moment(customData.ts).fromNow()}`}
          </Typography>
        )}
      </div>
    );
  }, [customData, staleIndicator, now]);

  return (
    <div className={classes.container}>
      {variant === 'MOWidget' && labelContent}
      {imageContent}
    </div>
  );
};

ImageComponent.propTypes = {
  customData: PropTypes.shape({
    _image: PropTypes.string,
    ts: PropTypes.number,
    customField: PropTypes.string,
  }),
  label: PropTypes.string,
  maximized: PropTypes.bool,
  staleIndicator: PropTypes.bool,
  now: PropTypes.number.isRequired,
  variant: PropTypes.oneOf(['GCWidget', 'MOWidget']),
};

export default ImageComponent;
