import assert from 'assert';

import { handleUnadmittedIdentity } from '../src/server/isoRobots/index';

const UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function deps(admitted = false) {
  const diagnostics = [];
  const warnings = [];
  return {
    roster: { isAdmitted: () => admitted },
    seenUnadmitted: new Set(),
    diagnostic: (name, data) => diagnostics.push({ name, data }),
    warn: (msg) => warnings.push(msg),
    diagnostics,
    warnings,
  };
}

describe('iso-robots handleUnadmittedIdentity', () => {
  it('warns and diagnoses for an unadmitted identity, reading uuid from identity.id (R2)', () => {
    const d = deps(false);
    handleUnadmittedIdentity({ id: UUID }, d);
    assert.strictEqual(d.diagnostics.length, 1);
    assert.deepStrictEqual(d.diagnostics[0], { name: 'iso-robot-not-admitted', data: { entityUuid: UUID } });
    assert.strictEqual(d.warnings.length, 1);
    assert.ok(d.warnings[0].includes(UUID));
  });

  it('does not fire when identity.entityUuid is set but identity.id is not (R2 regression guard)', () => {
    const d = deps(false);
    handleUnadmittedIdentity({ entityUuid: UUID }, d);
    assert.strictEqual(d.diagnostics.length, 0);
    assert.strictEqual(d.warnings.length, 0);
  });

  it('does nothing for an admitted identity', () => {
    const d = deps(true);
    handleUnadmittedIdentity({ id: UUID }, d);
    assert.strictEqual(d.diagnostics.length, 0);
    assert.strictEqual(d.warnings.length, 0);
  });

  it('warns only once per uuid per process', () => {
    const d = deps(false);
    handleUnadmittedIdentity({ id: UUID }, d);
    handleUnadmittedIdentity({ id: UUID }, d);
    assert.strictEqual(d.warnings.length, 1);
  });
});
