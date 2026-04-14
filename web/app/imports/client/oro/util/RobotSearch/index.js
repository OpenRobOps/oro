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
 * RobotSearch
 * Adds meteor method to search entities
 * Meteor Dependent component
 */
import React, { useCallback, useMemo, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import RobotSearchComponent from './RobotSearchComponent';
import { ID_TYPE_ROBOT } from '../../../../shared/constants';

const RobotSearch = (props) => {
  const { selectedRobotId } = props;
  const [selectedRobot, setSelectedRobot] = useState();
  const [isRobotLoading, setIsRobotLoading] = useState(false);

  const searchEntitiesMeteorCall = useCallback(
    (params, cb) => Meteor.call('search.entities', params, cb), []
  );

  // When there is a new selected robotId use the search.entities meteor call to
  // get the robot entity of that id (needed to used as value for the Autocomplete
  // in RobotSearchComponent)
  useEffect(() => {
    setIsRobotLoading(true);
    searchEntitiesMeteorCall({
      queryString: selectedRobotId,
      entityTypes: [ID_TYPE_ROBOT],
      filters: { }
    },
    (error, result) => {
      if (error) {
        console.error('Error loading robot data', error);
      } else if (result && result[0]) {
        if (selectedRobotId) {
          setSelectedRobot(result[0]);
        } else {
          setSelectedRobot();
        }
      }
      setIsRobotLoading(false);
    });
  }, [selectedRobotId]);

  return (
    <RobotSearchComponent
      searchEntitiesMeteorCall={searchEntitiesMeteorCall}
      selectedRobot={selectedRobot}
      isRobotLoading={isRobotLoading}
      {...props}
    />
  );
};

RobotSearch.propTypes = {
  selectedRobotId: PropTypes.string
};

export default RobotSearch;
