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

import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
import {
  normalizeMapAnnotation, invert3x3, findFrameTransform, fitRigidTransform2D,
  validateTransformMatrix, IDENTITY_3X3, mapsListQuery, transformLocalizationData,
  inverseTransform, transformDelta,
} from '../../shared/maps';
import { transformPose } from '../../shared/geometry';
import { resetDatabase } from './setup';
import { SpatialAnnotations } from '../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');

const near = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).to.be.below(eps, `${a} !== ${b}`);
const rot = (t, tx, ty) => [
  [Math.cos(t), -Math.sin(t), tx],
  [Math.sin(t), Math.cos(t), ty],
  [0, 0, 1],
];

describe('shared/maps', () => {
  describe('normalizeMapAnnotation', () => {
    it('normalizes a legacy robot map doc', () => {
      const n = normalizeMapAnnotation({
        entityType: 'robot', entityId: 'r1', label: 'map',
        map: { frameId: 'map', x: -1, y: -2, resolution: 0.05, width: 10, height: 20, formatVersion: 1, dataHash: 'h', data: 'AAAA' },
      });
      expect(n.entity).to.deep.equal({ entityType: 'robot', entityId: 'r1', frameId: 'map' });
      expect(n.annotation).to.include({ annotationId: 'map', label: 'map', x: -1, y: -2, resolution: 0.05, width: 10, height: 20, formatVersion: 1, dataHash: 'h', data: 'AAAA' });
    });
    it('normalizes a v2 system map doc', () => {
      const n = normalizeMapAnnotation({
        entityType: 'system', entityId: '0', label: 'pretty', type: 'map', frameId: 'ccs-1',
        annotation: { label: 'Pretty', x: 0, y: 0, resolution: 0.0125, width: 1600, height: 1600, formatVersion: 2 },
      });
      expect(n.entity.frameId).to.equal('ccs-1');
      expect(n.annotation.annotationId).to.equal('pretty');
      expect(n.annotation.label).to.equal('Pretty');
    });
    it('defaults a missing frameId to "map" and returns null for non-map docs', () => {
      expect(normalizeMapAnnotation({ entityType: 'robot', entityId: 'r1', label: 'm', map: { x: 0 } }).entity.frameId).to.equal('map');
      expect(normalizeMapAnnotation({ entityType: 'robot', entityId: 'r1', label: 'w', type: 'waypoint', annotation: {} })).to.equal(null);
      expect(normalizeMapAnnotation(null)).to.equal(null);
    });
  });

  describe('invert3x3', () => {
    it('inverts an affine rotation+translation', () => {
      const m = rot(0.7, 3, -2);
      const p = transformPose({ x: 1, y: 2, theta: 0.1 }, { frameId: 'b', aTb: { m } });
      const back = transformPose(p, { frameId: 'a', aTb: { m: invert3x3(m) } });
      near(back.x, 1); near(back.y, 2); near(back.theta, 0.1);
    });
  });

  describe('findFrameTransform', () => {
    const systemDoc = { transformations: { map: { frameId: 'ccs', aTb: { m: rot(0, 10, 10) } } } };
    const robotDoc = { transformations: { map: { frameId: 'ccs', aTb: { m: rot(0, 1, 1) } } } };
    it('returns identity when frames are equal', () => {
      expect(findFrameTransform({ from: 'map', to: 'map' }).aTb.m).to.deep.equal(IDENTITY_3X3);
    });
    it('prefers the robot doc over the system doc', () => {
      expect(findFrameTransform({ robotDoc, systemDoc, from: 'map', to: 'ccs' }).aTb.m[0][2]).to.equal(1);
      expect(findFrameTransform({ systemDoc, from: 'map', to: 'ccs' }).aTb.m[0][2]).to.equal(10);
    });
    it('derives the inverse when only the reverse entry exists', () => {
      const t = findFrameTransform({ systemDoc, from: 'ccs', to: 'map' });
      expect(t.frameId).to.equal('map');
      near(t.aTb.m[0][2], -10);
    });
    it('returns null when no entry links the frames', () => {
      expect(findFrameTransform({ systemDoc, from: 'map', to: 'other' })).to.equal(null);
      expect(findFrameTransform({ from: 'a', to: 'b' })).to.equal(null);
    });
  });

  describe('fitRigidTransform2D', () => {
    it('recovers a +90° rotation plus translation from 3 pairs', () => {
      const m = rot(Math.PI / 2, 5, -3);
      const src = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 2 }];
      const pairs = src.map((p) => ({ from: p, to: transformPose(p, { frameId: 'b', aTb: { m } }) }));
      const fit = fitRigidTransform2D(pairs);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) near(fit[i][j], m[i][j], 1e-6);
    });
    it('throws with fewer than 3 pairs', () => {
      expect(() => fitRigidTransform2D([{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }])).to.throw(/at least 3/);
    });
  });

  describe('validateTransformMatrix', () => {
    it('accepts a rigid transform and rejects malformed ones', () => {
      expect(validateTransformMatrix(rot(1, 2, 3))).to.equal(null);
      expect(validateTransformMatrix([[1, 0], [0, 1]])).to.match(/3x3/);
      expect(validateTransformMatrix([[1, 0, 0], [0, 1, 0], [0, 0, 2]])).to.match(/last row/);
      expect(validateTransformMatrix([[2, 0, 0], [0, 2, 0], [0, 0, 1]])).to.match(/rotation/);
      expect(validateTransformMatrix([[1, 0, 0], [0, -1, 0], [0, 0, 1]])).to.match(/reflection/);
      expect(validateTransformMatrix([[NaN, 0, 0], [0, 1, 0], [0, 0, 1]])).to.match(/finite/);
    });
  });

  describe('mapsListQuery', () => {
    beforeEach(async function () {
      await resetDatabase();
    });

    it('matches robot maps (legacy and v2) and system maps, not other annotation types', async () => {
      await SpatialAnnotations.insertAsync({ entityType: 'robot', entityId: 'r1', label: 'a', type: 'map', annotation: {} });
      await SpatialAnnotations.insertAsync({ entityType: 'robot', entityId: 'r1', label: 'map', map: { x: 0 } });
      await SpatialAnnotations.insertAsync({ entityType: 'system', entityId: '0', label: 's', type: 'map', annotation: {} });
      await SpatialAnnotations.insertAsync({ entityType: 'robot', entityId: 'r2', label: 'b', type: 'map', annotation: {} });
      await SpatialAnnotations.insertAsync({ entityType: 'robot', entityId: 'r1', label: 'w', type: 'waypoint', annotation: {} });

      const docs = await SpatialAnnotations.find(mapsListQuery('r1')).fetchAsync();
      expect(docs.map((d) => d.label).sort()).to.deep.equal(['a', 'map', 's']);
    });
  });

  describe('transformLocalizationData', () => {
    const t = { frameId: 'ccs', aTb: { m: rot(Math.PI / 2, 0, 0) } };
    it('rotates pose, path points and costmap origin; leaves lasers alone', () => {
      const data = {
        robotPose: { x: 1, y: 0, theta: 0 },
        laserRanges: { ranges: [1, 2] },
        paths: { p1: { points: [{ x: 1, y: 0 }, { x: 2, y: 0 }] } },
        costmap: { x: 1, y: 0, theta: 0, width: 2 },
      };
      const out = transformLocalizationData(data, t);
      near(out.robotPose.x, 0); near(out.robotPose.y, 1); near(out.robotPose.theta, Math.PI / 2);
      expect(out.robotPose.frameId).to.equal('ccs');
      near(out.paths.p1.points[1].y, 2);
      near(out.costmap.y, 1); expect(out.costmap.width).to.equal(2);
      expect(out.laserRanges).to.equal(data.laserRanges);
    });
    it('returns the same object for identity/null', () => {
      const data = { robotPose: { x: 1, y: 2 } };
      expect(transformLocalizationData(data, null)).to.equal(data);
      expect(transformLocalizationData(data, { frameId: 'map', aTb: { m: IDENTITY_3X3 } })).to.equal(data);
    });
  });

  describe('inverse for map clicks', () => {
    const t = { frameId: 'ccs', aTb: { m: rot(Math.PI / 2, 10, 0) } };
    it('inverseTransform round-trips a pose', () => {
      const p = transformPose({ x: 1, y: 2, theta: 0.3 }, t);
      const back = transformPose(p, inverseTransform(t));
      near(back.x, 1); near(back.y, 2); near(back.theta, 0.3);
      expect(inverseTransform(null)).to.equal(null);
    });
    it('transformDelta rotates the translation only', () => {
      const d = transformDelta({ x: 1, y: 0, theta: 0.2 }, inverseTransform(t));
      near(d.x, 0); near(d.y, -1); near(d.theta, 0.2);
    });
  });
});
