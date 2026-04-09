/**
 * LoadingCircle
 * This simple component displays a circular loading progress indicator.
 */
import React from 'react';
import { CircularProgress } from '@mui/material';

const LoadingCircle = props => (
  <CircularProgress size={70} color="primary" thickness={4} {...props} />
);

export default LoadingCircle;
