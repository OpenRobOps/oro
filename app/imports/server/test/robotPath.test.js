import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
import {
  resolveRobotPath, robotPathFromSpec, robotPathToSpec, ROBOT_UI_PREFERENCES_COLLECTION,
} from '../../shared/robotPath';

if (!Meteor.isTest) throw new Error('This is TEST code only');

const G = { label: 'Global', lineColor: ['#2A3C98', '#7F8CC7'], lineWidth: 2 };
const L = { label: 'Local', lineColor: ['#B4622A'], isDashed: true };

describe('shared/robotPath', () => {
  it('exports the client collection name', () => {
    expect(ROBOT_UI_PREFERENCES_COLLECTION).to.equal('robot_ui_preferences');
  });
  it('robotPathFromSpec/robotPathToSpec round-trip', () => {
    const stored = robotPathFromSpec({ 0: G, 1: L });
    expect(stored.elementList).to.deep.equal(['0', '1']);
    expect(stored.elementValues['1']).to.deep.equal(L);
    expect(robotPathToSpec(stored)).to.deep.equal({ paths: { 0: G, 1: L } });
  });
  it('robotPathFromSpec drops unknown fields and undefined values', () => {
    const stored = robotPathFromSpec({ 0: { ...G, bogus: 1, pointWidth: undefined } });
    expect(stored.elementValues['0']).to.deep.equal(G);
  });
  describe('resolveRobotPath', () => {
    const systemCfg = robotPathFromSpec({ 0: G, 1: L });
    it('returns {} with nothing configured', () => {
      expect(resolveRobotPath({})).to.deep.equal({});
    });
    it('uses the system entries when the robot has none', () => {
      expect(resolveRobotPath({ systemCfg })).to.deep.equal({ elementValues: { 0: G, 1: L } });
    });
    it('robot entry replaces the whole system entry for that id only', () => {
      const robotCfg = robotPathFromSpec({ 0: { lineColor: ['#FF0000'] } });
      expect(resolveRobotPath({ robotCfg, systemCfg })).to.deep.equal({
        elementValues: { 0: { lineColor: ['#FF0000'] }, 1: L },
      });
    });
  });
});
