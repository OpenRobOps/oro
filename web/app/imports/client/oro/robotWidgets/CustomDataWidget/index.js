/**
 * Custom Data widget
 * allows displaying custom key value pairs reported by the agent
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO modules
import useCustomWidgetData from '../../hooks/useCustomWidgetData';
import CustomDataWidgetComponent from './CustomDataWidgetComponent';

const CustomDataWidget = ({ robotId, config }) => {
  const { mapping } = config || {};
  const { sourceId: customField, source: dataType } = mapping || {};

  const { isLoading, data } = useCustomWidgetData(robotId, dataType, customField);

  return (
    <CustomDataWidgetComponent
      customData={data}
      dataType={dataType}
      config={config}
      isLoading={isLoading}
    />
  );
};

CustomDataWidget.propTypes = {
  robotId: PropTypes.string,
  config: PropTypes.object
};

export default CustomDataWidget;
