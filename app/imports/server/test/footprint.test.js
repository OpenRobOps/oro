import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
import {
  pairsFromPoints, pointsFromPairs, isValidPolygon, resolveFootprint, SUPPRESSED_POSE,
} from '../../shared/footprint';
import { resetDatabase } from './setup';
import { UIPreferences, Robots } from '../../lib/collections';
import { resolvedFootprintFor, footprintDocsFor } from '../footprints';
import { apiGetRobotFootprint } from '../rest/robots';

if (!Meteor.isTest) throw new Error('This is TEST code only');

const SQUARE = [[0.3, 0.2], [0.3, -0.2], [-0.3, -0.2], [-0.3, 0.2]];

describe('shared/footprint', () => {
  it('converts between {x,y} points and [x,y] pairs', () => {
    const pts = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
    expect(pairsFromPoints(pts)).to.deep.equal([[1, 2], [3, 4], [5, 6]]);
    expect(pointsFromPairs(pairsFromPoints(pts))).to.deep.equal(pts);
  });

  it('isValidPolygon: ≥3 finite pairs', () => {
    expect(isValidPolygon(SQUARE)).to.equal(true);
    expect(isValidPolygon(SQUARE.slice(0, 2))).to.equal(false);
    expect(isValidPolygon([[0, 0], [1, NaN], [2, 2]])).to.equal(false);
    expect(isValidPolygon(null)).to.equal(false);
  });

  describe('resolveFootprint', () => {
    const reported = { points: SQUARE, height: 0.4 };
    it('returns {} with nothing configured or reported', () => {
      expect(resolveFootprint({})).to.deep.equal({});
    });
    it('uses the reported polygon when config defines neither footprint nor radius', () => {
      expect(resolveFootprint({ reported })).to.deep.equal({ footprint: SQUARE });
      expect(resolveFootprint({ systemCfg: { primaryColor: '#111111' }, reported }))
        .to.deep.equal({ footprint: SQUARE, primaryColor: '#111111' });
    });
    it('config radius or footprint beats the reported polygon', () => {
      expect(resolveFootprint({ systemCfg: { radius: 0.3 }, reported })).to.deep.equal({ radius: 0.3 });
    });
    it('merges field-wise, robot over system', () => {
      const out = resolveFootprint({
        systemCfg: { radius: 0.3, primaryColor: '#111111', opacity: 0.8 },
        robotCfg: { primaryColor: '#222222' },
      });
      expect(out).to.deep.equal({ radius: 0.3, primaryColor: '#222222', opacity: 0.8 });
    });
    it('a robot-scope null suppresses the system value and the reported one, and is dropped', () => {
      const out = resolveFootprint({ systemCfg: { radius: 0.3 }, robotCfg: SUPPRESSED_POSE, reported });
      expect(out).to.deep.equal({});
    });
    it('ignores an invalid reported polygon', () => {
      expect(resolveFootprint({ reported: { points: [[0, 0]] } })).to.deep.equal({});
    });
  });

  describe('server resolution', () => {
    beforeEach(async () => {
      await resetDatabase();
      await Robots.insertAsync({ _id: 'iso1', name: 'iso1', version: 'iso-21423-v1', status: { agentOnline: true }, updateStamp: Date.now(),
        footprint: { points: SQUARE, height: 0.4, ts: 1, source: 'iso21423' } });
      await Robots.insertAsync({ _id: 'r1', name: 'r1', version: '1', status: { agentOnline: true }, updateStamp: Date.now() });
      await UIPreferences.insertAsync({ entityType: 'system', entityId: '0', map: { pose: { radius: 0.3, primaryColor: '#111111' } } });
      await UIPreferences.insertAsync({ entityType: 'robot', entityId: 'r1', map: { pose: { primaryColor: '#222222' } } });
    });
    it('resolvedFootprintFor: robot over system; system radius beats reported polygon', async () => {
      expect(await resolvedFootprintFor('r1')).to.deep.equal({ radius: 0.3, primaryColor: '#222222' });
      expect(await resolvedFootprintFor('iso1')).to.deep.equal({ radius: 0.3, primaryColor: '#111111' });
    });
    it('footprintDocsFor: reported polygon used when no radius/footprint is configured', async () => {
      await UIPreferences.updateAsync({ entityType: 'system', entityId: '0' }, { $set: { 'map.pose': { primaryColor: '#111111' } } });
      const docs = await footprintDocsFor(['r1', 'iso1']);
      expect(docs.iso1).to.deep.equal({ footprint: SQUARE, primaryColor: '#111111' });
      expect(docs.r1).to.deep.equal({ primaryColor: '#222222' });
    });
    it('REST: returns geometry only, {} when none', async () => {
      const [body] = await apiGetRobotFootprint({ robot: { getId: () => 'r1' } });
      expect(body).to.deep.equal({ radius: 0.3 });
      await UIPreferences.removeAsync({});
      const [empty] = await apiGetRobotFootprint({ robot: { getId: () => 'r1' } });
      expect(empty).to.deep.equal({});
    });
  });
});
