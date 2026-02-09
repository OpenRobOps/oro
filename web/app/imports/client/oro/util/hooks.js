import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { isEmpty, isString, isArray } from 'lodash';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMethod } from './meteorUtils';
// ORO modules

/**
 * Receives a robotId and returns the robot
 * it uses useTracker to load the data
 * @param {string} robotId
 */
const useRobotData = (robotId) => {
  const [robot] = useTracker(() => {
    Meteor.subscribe('robot.details', { robotId });
    const robotData = Robots.findOne({ _id: robotId });
    return [robotData];
  }, [robotId]);
  return robot;
};

export {
  useRobotData,
};
