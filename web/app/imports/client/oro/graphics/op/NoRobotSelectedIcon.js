/**
 * No Robot selected icon:
 * This icon is used when the user is looking at a robot Widget without a robot selected
 */
import React from 'react';
import classnames from 'classnames';
import { withStyles } from 'tss-react/mui';
import { Grid, Typography } from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';

const styles = (theme) => ({
  noRobotSelectedIcon: {
    height: '73px',
    width: '60px',
    display: 'flex',
    alignSelf: 'center',
    padding: '10px'
  },
  currentNoRobotTypography: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.lightPlus,
    textAlign: 'center',
    color: theme.palette.text.title
  },
  currentNoRobotBoldTypography: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.medium
  },
  noRobotSelectedContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    alignContent: 'center'
  }
});

const NoRobotSelectedIcon = ({ classes }) => (
  <Grid container className={classes.noRobotSelectedContainer}>
    <SvgIcon
      width='60'
      height='73'
      viewBox='0 0 60 73'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      classes={{
        root: classes.noRobotSelectedIcon,
      }}
    >
      <path d="M15.7117 38.6425C13.3477 38.6425 11.4179 36.7257 11.4179 34.3418C11.4179 31.9578 13.3316 30.041 15.7117 30.041C18.0917 30.041 20.0054 31.9578 20.0054 34.3418C20.0054 36.7257 18.0756 38.6425 15.7117 38.6425Z" fill="white" />
      <path d="M44.2885 38.6425C41.9245 38.6425 39.9947 36.7257 39.9947 34.3418C39.9947 31.9578 41.9084 30.041 44.2885 30.041C46.6685 30.041 48.5822 31.9578 48.5822 34.3418C48.5822 36.7257 46.6524 38.6425 44.2885 38.6425Z" fill="#B2B2B2" />
      <path d="M54.2911 8.58539H39.9946V1.86849C39.9946 0.837599 39.1584 0 38.1292 0H21.8547C20.8255 0 19.9893 0.837599 19.9893 1.86849V8.58539H5.70893C2.55696 8.58539 0 11.1626 0 14.3036V61.5474C0 64.7045 2.57304 67.2657 5.70893 67.2657H11.4179V71.1315C11.4179 72.1624 12.2541 73 13.2833 73H46.7167C47.7459 73 48.5821 72.1624 48.5821 71.1315V67.2657H54.2911C57.443 67.2657 60 64.6884 60 61.5474V14.3197C60.0161 11.1626 57.443 8.58539 54.2911 8.58539ZM7.14018 34.3577C7.14018 29.622 10.9837 25.7723 15.7116 25.7723C20.4396 25.7723 24.283 29.622 24.283 34.3577C24.283 39.0933 20.4396 42.9431 15.7116 42.9431C10.9837 42.9431 7.14018 39.0933 7.14018 34.3577ZM40.0107 54.3956C40.7987 54.3956 41.442 55.0399 41.442 55.8292C41.442 56.6185 40.7987 57.2628 40.0107 57.2628H19.9893C19.2013 57.2628 18.558 56.6185 18.558 55.8292C18.558 55.0399 19.2013 54.3956 19.9893 54.3956H40.0107ZM44.2884 42.9431C39.5604 42.9431 35.717 39.0933 35.717 34.3577C35.717 29.622 39.5604 25.7723 44.2884 25.7723C49.0163 25.7723 52.8598 29.622 52.8598 34.3577C52.8598 39.0933 49.0324 42.9431 44.2884 42.9431Z" fill="#B2B2B2" />
      <path d="M15.7117 38.6562C18.083 38.6562 20.0054 36.7307 20.0054 34.3554C20.0054 31.9802 18.083 30.0547 15.7117 30.0547C13.3403 30.0547 11.4179 31.9802 11.4179 34.3554C11.4179 36.7307 13.3403 38.6562 15.7117 38.6562Z" fill="#B2B2B2" />
      <defs>
        <clipPath id="clip0">
          <rect width="60" height="73" fill="white" />
        </clipPath>
      </defs>
    </SvgIcon>
    <Typography
      className={classnames(
        classes.currentNoRobotTypography,
        classes.currentNoRobotBoldTypography
      )}
    >
      No robot selected.
    </Typography>
    <Typography className={classes.currentNoRobotTypography}>
      Select a robot to see content here.
    </Typography>
  </Grid>
);

export default withStyles(NoRobotSelectedIcon, styles, { withTheme: true });
