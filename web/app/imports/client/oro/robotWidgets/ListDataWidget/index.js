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
