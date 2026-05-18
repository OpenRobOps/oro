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

/**
 * Chip Option Container - displays active filter chips and an options toggle button
 */
import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Grid, Button, Chip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { ListAlt } from '@mui/icons-material';
import WrapWithTooltip from '../WrapWithTooltip';

const maxChipContainerWidth = 950;

const useStyles = makeStyles()(theme => ({
  controlOptionButtonContainer: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '10px'
  },
  buttonContainer: {
    fontSize: '13px',
    color: theme.palette.text.title,
    textTransform: 'capitalize',
    fontWeight: theme.fontWeight.lightPlus
  },
  startIcon: {
    marginLeft: '0px',
    marginRight: '4px'
  },
  controlChipContainer: {
    cursor: 'pointer',
    background: theme.palette.background.veryLightGray,
    boxShadow: 'inset 1px 1px 3px 1px rgba(0, 0, 0, 0.3)',
    borderRadius: '5px',
    width: 'fit-content',
    minWidth: '190px',
    padding: '4px 0px',
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center'
  },
  controlContainer: {
    background: theme.palette.background.white,
    position: 'relative',
    minHeight: '40px',
    margin: '0px',
    padding: '0px 3px',
    display: 'flex',
    alignSelf: 'center'
  },
  flexControlChip: {
    cursor: 'pointer',
    background: theme.palette.text.title,
    borderRadius: '5px',
    color: 'white',
    margin: '1px',
    fontSize: '13px',
    maxHeight: '26px'
  },
  filterLabel: {
    fontSize: '13px',
    position: 'relative',
    lineHeight: 'unset',
    display: 'flex',
    alignItems: 'center'
  },
  chipSubContainer: {
    padding: '0 3px'
  },
  controlOptionButtonTop: {
    alignItems: 'flex-start',
  }
}));

const ChipOptionContainer = ({ handleFilterDelete, toggleShowingOptions, activeFilters }) => {
  const { classes, cx } = useStyles();
  const containerRef = useRef(null);
  const containerWidth = (
    (containerRef.current?.offsetWidth) > maxChipContainerWidth
  );

  return (
    <Grid className={classes.controlContainer} ref={containerRef}>
      <Grid
        onClick={toggleShowingOptions}
        className={classes.controlChipContainer}
      >
        <Grid className={classes.chipSubContainer}>
          {activeFilters && activeFilters.map(filter => (
            WrapWithTooltip(filter.tooltip, (
              <Chip
                key={`${filter._id || filter.type}`}
                label={(
                  <Typography className={classes.filterLabel}>
                    {filter.label}
                    {filter.icon}
                    {filter.name}
                  </Typography>
                )}
                onDelete={!filter.disableDelete ? handleFilterDelete(filter) : undefined}
                className={classes.flexControlChip}
                color="secondary"
              />
            ), { withoutDivWrapper: true })
          ))}
        </Grid>
      </Grid>
      <Grid
        item
        className={cx(
          classes.controlOptionButtonContainer,
          { [classes.controlOptionButtonTop]: containerWidth }
        )}
      >
        <Grid>
          <Button
            title="Toggle options"
            data-test="control-options-toggle"
            onClick={toggleShowingOptions}
            className={classes.buttonContainer}
            startIcon={<ListAlt style={{ fontSize: '24px' }} />}
            classes={{ startIcon: classes.startIcon }}
          >
            Options
          </Button>
        </Grid>
      </Grid>
    </Grid>
  );
};

ChipOptionContainer.propTypes = {
  activeFilters: PropTypes.array,
  handleFilterDelete: PropTypes.func.isRequired,
  toggleShowingOptions: PropTypes.func.isRequired,
};

export default ChipOptionContainer;
