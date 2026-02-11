/**
 * VitalsWidget
 *
 * This component displays some of the robot information inside Ground Control. It is a container
 * for VitalsTextEntry and VitalsGaugeEntry components.
 */
import React, { Component } from 'react';
import { withStyles } from 'tss-react/mui';
import { Grid } from '@mui/material';
import PropTypes from 'prop-types';
// ORO modules
import VitalsTextEntry from './VitalsTextEntry';
import VitalsGaugeEntry from './VitalsGaugeEntry';
import { VITAL_ELEMENT_GAUGE, VITAL_ELEMENT_TEXT, VITAL_ELEMENT_HIDDEN } from '../../../../lib/uiPreferences';
import VitalsZeroData from './VitalsZeroData';

const styles = () => ({
  container: {
    height: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center'
  },
  vital: {
    height: '50%',
    width: '50%',
    justifyContent: 'center',
    alignItems: 'center'
  }
});

class VitalsWidgetComponent extends Component {
  constructor(props) {
    super(props);
    // Flag to indicate usage tracking was already sent for complex attributes
    this.complexAttributesTracked = false;
  }

  /**
   * Formats a number before display.
   * Removes unnecessary extra precision.
   *
   * TODO(herchu) Remove this yet-another-formatting function!
   */
  formatNumber = (total) => {
    if (total === undefined) {
      return '--';
    }
    // Use ints for large values (>10) or two decimal points otherwise
    return total > 10 ? Math.round(total) : Math.round(total * 10) / 10;
  }

  /**
   * Renders a vital entry from values and configuration.
   */
  renderVital = (attributeId, ix) => {
    const {
      classes,
      attributeValues = {},
      robot = {},
      robotId,
      trackEvent,
      isZeroData
    } = this.props;
    const { status, modes } = robot;
    const offline = !(status && status.agentOnline);
    const config = this.props.config
      && this.props.config.elementValues
      && this.props.config.elementValues[attributeId];
    if (!config) {
      return null;
    }

    if (config.isComplex && attributeValues[attributeId] && !this.complexAttributesTracked
      // Get time 24hrs ago and only report to pendo if attribute has been
      // published within that time.
      && attributeValues[attributeId].ts > Date.now() - 1000 * 60 * 60 * 24) {
      trackEvent('complex-attrs-used', { robotId, label: config.label });
      this.complexAttributesTracked = true;
    }

    let value = attributeValues[attributeId] && attributeValues[attributeId].value;
    let disabled = false;
    if (isZeroData) {
      return (
        <Grid container key={ix} className={classes.vital} size={6}>
          <VitalsZeroData counter={ix} />
        </Grid>
      );
    }
    if (config.type == VITAL_ELEMENT_HIDDEN) {
      return null;
    } else if (config.type == VITAL_ELEMENT_GAUGE) {
      if (config.unit == '%') {
        // Percentage values are assumed to be normalized in [0..1] range
        value = this.formatNumber(value * 100);
      }
      return (
        <Grid container key={ix} className={classes.vital} size={6}>
          <VitalsGaugeEntry
            {...config}
            legend={config.label}
            offline={offline}
            primaryValue={value}
            disabled={disabled}
          />
        </Grid>
      );
    } else if (config.type == VITAL_ELEMENT_TEXT) {
      return (
        <Grid
          container
          key={ix}
          className={classes.vital}
          data-test="mc-vitals-widget"
          size={6}>
          <VitalsTextEntry
            {...config}
            legend={config.label}
            offline={offline}
            value={value}
            disabled={disabled}
          />
        </Grid>
      );
    } else {
      return (
        <Grid key={ix} size={6}>
          <div>
            Invalid type: {config.type}
          </div>
        </Grid>
      );
    }
  }

  render() {
    const { classes, config } = this.props;
    const elements = (config && config.elementList) || [];
    return (
      <Grid
        container
        spacing={2}
        direction="row"
        className={classes.container}
      >
        {elements.map((attributeId, ix) => this.renderVital(attributeId, ix))}
      </Grid>
    );
  }
}

VitalsWidgetComponent.propTypes = {
  // Widget aesthetics
  classes: PropTypes.object,
  // Widget loading status and configuration
  isLoading: PropTypes.bool,
  config: PropTypes.object,
  // Robot and attribute data
  robotId: PropTypes.string,
  robot: PropTypes.object,
  attributeValues: PropTypes.object,
  // Pendo event tracking callback (see imports/client/tracking.js)
  trackEvent: PropTypes.func,
  // ZeroDataExperience:
  isZeroData: PropTypes.bool
};

export default withStyles(VitalsWidgetComponent, styles, { withTheme: true });
