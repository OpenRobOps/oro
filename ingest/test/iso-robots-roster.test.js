import assert from 'assert';

import MongoManager from '../src/mongo';
import { AdmittedRoster } from '../src/server/isoRobots/roster';
import { COLLECTIONS } from '../src/shared/constants';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const robots = () => new MongoManager().getCollection(COLLECTIONS.ROBOTS);

function recorder() {
  const admitted = [];
  const revoked = [];
  return {
    admitted,
    revoked,
    onAdmit: async (uuid) => { admitted.push(uuid); },
    onRevoke: async (uuid) => { revoked.push(uuid); },
  };
}

const rosterFor = (rec) => new AdmittedRoster({ collection: robots(), ...rec });

describe('iso-robots AdmittedRoster', () => {
  beforeEach(async () => {
    await robots().deleteMany({});
  });

  it('admits nothing when the fleet is empty', async () => {
    const rec = recorder();
    const diff = await rosterFor(rec).refresh();
    assert.deepStrictEqual(diff, { admitted: [], revoked: [] });
  });

  it('admits only documents whose _id is a UUID', async () => {
    await robots().insertMany([
      { _id: A, name: 'ISO One' },
      { _id: 'flatland-ros2', name: 'A wire robot' },
    ]);
    const rec = recorder();
    const roster = rosterFor(rec);
    const diff = await roster.refresh();
    assert.deepStrictEqual(diff.admitted, [A]);
    assert.strictEqual(roster.isAdmitted(A), true);
    assert.strictEqual(roster.isAdmitted('flatland-ros2'), false);
  });

  it('normalizes case so an upper-case document id still matches an ISO identity', async () => {
    await robots().insertOne({ _id: A.toUpperCase(), name: 'Shouty' });
    const roster = rosterFor(recorder());
    await roster.refresh();
    assert.strictEqual(roster.isAdmitted(A), true);
  });

  it('is idempotent across refreshes', async () => {
    await robots().insertMany([{ _id: A, name: 'a' }, { _id: B, name: 'b' }]);
    const rec = recorder();
    const roster = rosterFor(rec);
    await roster.refresh();
    assert.deepStrictEqual(await roster.refresh(), { admitted: [], revoked: [] });
    assert.strictEqual(rec.admitted.length, 2);
  });

  it('revokes a robot whose document was deleted', async () => {
    await robots().insertMany([{ _id: A, name: 'a' }, { _id: B, name: 'b' }]);
    const rec = recorder();
    const roster = rosterFor(rec);
    await roster.refresh();
    await robots().deleteOne({ _id: B });
    const diff = await roster.refresh();
    assert.deepStrictEqual(diff.revoked, [B]);
    assert.deepStrictEqual(rec.revoked, [B]);
    assert.strictEqual(roster.isAdmitted(B), false);
  });

  it('keeps a robot admitted when its onAdmit threw, so the next pass retries', async () => {
    await robots().insertOne({ _id: A, name: 'a' });
    let calls = 0;
    const roster = new AdmittedRoster({
      collection: robots(),
      onAdmit: async () => { calls += 1; throw new Error('subscribe failed'); },
      onRevoke: async () => {},
    });
    await roster.refresh();
    await roster.refresh();
    assert.strictEqual(calls, 2);
    assert.strictEqual(roster.isAdmitted(A), false);
  });

  it('reports admittedIds sorted, so callers get a stable list', async () => {
    await robots().insertMany([{ _id: B, name: 'b' }, { _id: A, name: 'a' }]);
    const roster = rosterFor(recorder());
    await roster.refresh();
    assert.deepStrictEqual(roster.admittedIds(), [A, B]);
  });
});
