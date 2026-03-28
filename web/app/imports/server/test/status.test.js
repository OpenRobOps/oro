/**
 * Unit tests for lib/util.js
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
// ORO modules
import {
  getAggregatedFleetStatus,
  OFFLINE_STATUS_TIME
} from '../../lib/status';
// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

describe('status', () => {
  // Defaults declarations
  const NOW = Date.now();
  const OFFLINE_TIME = NOW - OFFLINE_STATUS_TIME - 1;
  const recentTimeSecs = 100; // seconds
  const longOfflineCustom = () => NOW - recentTimeSecs * 1000 - 1;
  const robotDefaults = () => [{
    _id: 'robot_1',
    status: {
      agentOnline: true
    },
    name: 'robot_1',
    updateStamp: NOW,
    statuses: {
      // default1: [-1, 1, -1, 2, -1, 0]
      first_status: {
        name: 'Battery',
        value: 0, // default: ok 0 index
        ts: NOW
      },
      second_status: {
        name: 'second_status',
        value: 20, // default: error 1 index
        ts: NOW
      },
      third_status: {
        name: 'third_status',
        value: 10, // default: warning 2 index
        ts: NOW
      }
    }
  },
  {
    _id: 'robot_2',
    status: {
      agentOnline: true
    },
    name: 'Arrakis',
    updateStamp: NOW,
    statuses: {
      // default2: [-1, 2, -1, 0, -1, 1]
      first_status: {
        name: 'Battery',
        value: 10, // default: warning 0 index
        ts: NOW
      },
      second_status: {
        name: 'second_status',
        value: 0, // default: ok 1 index
        ts: NOW
      },
      third_status: {
        name: 'third_status',
        value: 20, // default: error 2 index
        ts: NOW
      }
    }
  },
  {
    _id: 'robot_3',
    status: {
      agentOnline: false
    },
    name: 'robot_3',
    updateStamp: longOfflineCustom(),
    statuses: {
      // default3 (ignored!): [-1, 0, -1, 1, -1, 2]
      first_status: {
        name: 'Battery',
        value: 20, // default: error 0 index, should be ignored
        ts: OFFLINE_TIME
      },
      second_status: {
        name: 'second_status',
        value: 10, // default: warning 1 index, should be ignored
        ts: OFFLINE_TIME
      },
      third_status: {
        name: 'third_status',
        value: 0, // default: ok 2 index, should be ignored
        ts: OFFLINE_TIME
      }
    }
  }];

  const statusListDefaults = () => [
    'first_status', 'second_status', 'third_status'
  ];

  const conditionalCollectioName = 'only-this-collection';
  const statusConfigs = {
    first_status: {
      enabledModes: [conditionalCollectioName]
    },
  };
  // initialize variables for testing data
  let robots = [];
  let statusList = [];

  beforeEach(() => {
    // restore defaults
    robots = robotDefaults();
    statusList = statusListDefaults();
  });

  let fleetStatus = [];
  it('aggregates Fleet Status, ignores long offline robots', () => {
    // Sum of the 3 defaults:
    // default1: [-1, 1, -1, 2, -1, 0]
    // default2: [-1, 2, -1, 0, -1, 1]
    // default3: [-1, 0, -1, 1, -1, 2] -> ignored!
    // expected: [-2, 1, -2, 0, -2, 0]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 20,
      ts: NOW,
      agentOnline: true,
      visibleStatusValue: [-2, 1, -2, 0, -2, 0]
    });
    // Remove an error, check it changes the index and sum
    robots[0].statuses.second_status.value = 0;
    // default1: [0, -1, -1, 2, -2, 0]
    // default2: [-1, 2, -1, 0, -1, 1]
    // default3: [-1, 0, -1, 1, -1, 2] -> ignored!
    // expected: [-1, 2, -2, 0, -3, 0]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 20,
      ts: NOW,
      agentOnline: true,
      visibleStatusValue: [-1, 2, -2, 0, -3, 0]
    });
    // Remove another error, check it changes the index and sum
    robots[1].statuses.third_status.value = 0;
    // default1: [0, -1, -1, 2, -2, 0]
    // default2: [0, -1, -1, 0, -2, 1]
    // default3: [-1, 0, -1, 1, -1, 2] -> ignored!
    // expected: [0, -1, -2, 0, -4, 0]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 10, // with no errors, this is now 10!
      ts: NOW,
      agentOnline: true,
      visibleStatusValue: [0, -1, -2, 0, -4, 0]
    });
    // Remove the warnings, sums/index should change to ok!
    robots[0].statuses.third_status.value = 0;
    robots[1].statuses.first_status.value = 0;
    // default1: [0, -1, 0, -1, -3, 0]
    // default2: [0, -1, 0, -1, -3, 0]
    // default3: [-1, 0, -1, 1, -1, 2] -> ignored!
    // expected: [0, -1, 0, -1, -6, 0]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 0, // with no errors/warnings, this is now 0!
      ts: NOW,
      agentOnline: true,
      visibleStatusValue: [0, -1, 0, -1, -6, 0]
    });
    // Add 2 warnings, 2 errors sums/index should change to ok!
    robots[0].statuses.third_status.value = 10;
    robots[1].statuses.second_status.value = 10;
    robots[0].statuses.first_status.value = 20;
    robots[1].statuses.first_status.value = 20;
    const moreRecentTime = NOW + 100;
    const notSoRecentTime = NOW - 100;
    const mostRecentTime = NOW + 1000; // robot is offline but timestamp is recent!
    robots[0].statuses.first_status.ts = moreRecentTime;
    robots[1].statuses.first_status.ts = notSoRecentTime;
    robots[2].statuses.first_status.ts = mostRecentTime;
    // default1: [-1, 0, -1, 2, -1, 1]
    // default2: [-1, 0, -1, 1, -1, 2]
    // default3: [-1, 0, -1, 1, -1, 2] -> ignored!
    // expected: [-2, 0, -2, 1, -2, 1]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 20, // with 2 errors, 20
      ts: mostRecentTime, // timestamp should be the most recent one (largest value)
      agentOnline: true,
      visibleStatusValue: [-2, 0, -2, 1, -2, 1]
    });
  });
  it('Online robots and recentlyOnline robots are the same', () => {
    // Sum of the 3 defaults with 3rd being online:
    robots[2].status.agentOnline = true;
    // default1:  [-1, 1, -1, 2, -1, 0]
    // default2:  [-1, 2, -1, 0, -1, 1]
    // NowOnline: [-1, 0, -1, 1, -1, 2] -> NOT ignored anymore!
    // expected:  [-3, 0, -3, 0, -3, 0]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 20,
      ts: NOW,
      agentOnline: true,
      visibleStatusValue: [-3, 0, -3, 0, -3, 0]
    });
    // Sum of the 3 defaults with 3rd being recentlyOffline:
    robots[2].status.agentOnline = false;
    // have the robot be recently offline by being 50% into being long offline
    robots[2].updateStamp = NOW - (recentTimeSecs / 2) * 1000;
    // default1:  [-1, 1, -1, 2, -1, 0]
    // default2:  [-1, 2, -1, 0, -1, 1]
    // NowOnline: [-1, 0, -1, 1, -1, 2] -> NOT ignored anymore!
    // expected:  [-3, 0, -3, 0, -3, 0]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 20,
      ts: NOW,
      agentOnline: true,
      visibleStatusValue: [-3, 0, -3, 0, -3, 0]
    });
  });
  it('ignores statuses not in status list', () => {
    // pop last status on list
    statusList.pop();
    // default1:  [-1, 1, 0, -1, -1, 0] -> ignore third_status
    // default2:  [0, -1, -1, 0, -1, 1] -> ignore third_status
    // default3:  [-1, 0, -1, 1, 0, -1] -> fully ignored, offline!
    // expected:  [-1, 1, -1, 0, -2, 0]
    fleetStatus = getAggregatedFleetStatus(robots, statusList, recentTimeSecs, NOW);
    chai.assert.deepEqual(fleetStatus, {
      value: 20,
      ts: NOW,
      agentOnline: true,
      visibleStatusValue: [-1, 1, -1, 0, -2, 0]
    });
  });
});
