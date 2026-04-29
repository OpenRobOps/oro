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
 * List Data Widget Container
 * Container that allows List Data Widget to be run in the gallery
 *  - Uses useAttributeValues hook to subscribe and fetch attribute values
 *  - Passes the attributes to ListDataComponent as props
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import useAttributeValues from '../../hooks/useAttributeValues';
import ListDataComponent from './ListDataComponent';
import WithNoDataMessage from '../../util/WithNoDataMessage';

const EMPTY_LIST = [];

const ListData = ({ robotId, config, nowTs }) => {
  const attributes = useMemo(() => config?.elementList || EMPTY_LIST, [config?.elementList]);
  const { isLoading, data } = useAttributeValues(robotId, attributes);

  return (
    <ListDataComponent
      robotId={robotId}
      config={config}
      attributeValues={data}
      nowTs={nowTs}
      isLoading={isLoading}
    />
  );
};

ListData.propTypes = {
  robotId: PropTypes.string,
  config: PropTypes.object,
  nowTs: PropTypes.number
};

export default WithNoDataMessage(ListData, { ZeroDataComponent: ListData });
