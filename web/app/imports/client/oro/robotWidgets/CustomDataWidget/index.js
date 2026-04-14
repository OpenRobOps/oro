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
 * Custom Data widget
 * allows displaying custom key value pairs reported by the agent
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO modules
import useCustomWidgetData from '../../hooks/useCustomWidgetData';
import CustomDataWidgetComponent from './CustomDataWidgetComponent';

const CustomDataWidget = ({ robotId, config, nowTs }) => {
  const { mapping } = config || {};
  const { sourceId: customField, source: dataType } = mapping || {};

  const { isLoading, data } = useCustomWidgetData(robotId, dataType, customField);

  return (
    <CustomDataWidgetComponent
      customData={data}
      dataType={dataType}
      config={config}
      isLoading={isLoading}
      nowTs={nowTs}
    />
  );
};

CustomDataWidget.propTypes = {
  robotId: PropTypes.string,
  config: PropTypes.object,
  nowTs: PropTypes.number
};

export default CustomDataWidget;
