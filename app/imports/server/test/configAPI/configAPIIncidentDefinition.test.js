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
 * Configuration as code tests for incident definitions.
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import { KIND_INCIDENT_DEFINITION, LIST_FORMAT_FULL } from '../../../shared/configAPI';
import { ICM_SEV_1, ICM_SEV_2 } from '../../../shared/alerts';
import { IncidentConfiguration } from '../../../lib/alerts';
import { createUser } from '../configAPI';
import { ROLE_ADMIN, ROLE_VIEWER } from '../../../lib/roles';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

const makeConfigObject = (id, spec) => {
  const configObject = {
    kind: KIND_INCIDENT_DEFINITION,
    apiVersion: 'v0.1',
    metadata: { id }
  };
  // Only include `spec` when provided; `clear` rejects config objects carrying a spec key.
  if (spec !== undefined) {
    configObject.spec = spec;
  }
  return configObject;
};

const VALID_SPEC = {
  label: 'Battery incident',
  labelTemplate: 'Battery problem on {{robotName}}',
  error: { severity: ICM_SEV_1 },
  warning: { severity: ICM_SEV_2 },
  ok: {}
};

describe('configAPI:IncidentDefinition', () => {
  beforeEach(async () => {
    await resetDatabase();
    await new OroRoles().createDefaultRoles();
  });

  it('apply: requires configure permission', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({ configObject: makeConfigObject('batteryLow', VALID_SPEC), user })
    ).to.be.rejectedWith(/Unauthorized/);
  });

  it('apply: stores a definition keyed by triggerId', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject: makeConfigObject('batteryLow', VALID_SPEC), user });

    const doc = await IncidentConfiguration.findOneAsync({ _id: 'batteryLow' });
    expect(doc).to.be.ok;
    expect(doc.triggerId).eq('batteryLow');
    expect(doc.label).eq('Battery incident');
    expect(doc.labelTemplate).eq('Battery problem on {{robotName}}');
    expect(doc.error.severity).eq(ICM_SEV_1);
    expect(doc.warning.severity).eq(ICM_SEV_2);
  });

  it('apply: rejects an invalid spec (unknown field)', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('bad', { label: 'x', bogus: true }), user
      })
    ).to.be.rejected;
  });

  it('apply: rejects an invalid severity', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('bad', { error: { severity: 'NOPE' } }), user
      })
    ).to.be.rejected;
  });

  it('apply: re-applying updates the existing definition', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject: makeConfigObject('batteryLow', VALID_SPEC), user });
    await new ConfigAPI().apply({
      configObject: makeConfigObject('batteryLow', { ...VALID_SPEC, label: 'Renamed' }), user
    });
    const docs = await IncidentConfiguration.find({ _id: 'batteryLow' }).fetchAsync();
    expect(docs).to.have.length(1);
    expect(docs[0].label).eq('Renamed');
  });

  it('apply: null spec removes the definition (suppress)', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject: makeConfigObject('batteryLow', VALID_SPEC), user });
    await new ConfigAPI().apply({ configObject: makeConfigObject('batteryLow', null), user });
    expect(await IncidentConfiguration.findOneAsync({ _id: 'batteryLow' })).to.not.be.ok;
  });

  it('clear: removes the definition', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject: makeConfigObject('batteryLow', VALID_SPEC), user });
    await new ConfigAPI().clear({ configObject: makeConfigObject('batteryLow'), user });
    expect(await IncidentConfiguration.findOneAsync({ _id: 'batteryLow' })).to.not.be.ok;
  });

  it('apply: stores per-level autoActions', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({
      configObject: makeConfigObject('batteryLow', {
        label: 'Battery incident',
        error: { severity: ICM_SEV_1, autoActions: ['DockAuto'] },
        ok: { autoActions: ['BatteryCharge'] }
      }),
      user
    });
    const doc = await IncidentConfiguration.findOneAsync({ _id: 'batteryLow' });
    expect(doc.error.autoActions).deep.eq(['DockAuto']);
    expect(doc.ok.autoActions).deep.eq(['BatteryCharge']);
  });

  it('apply: rejects autoActions that are not an array of strings', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('bad', { error: { autoActions: [123] } }), user
      })
    ).to.be.rejected;
  });

  it('apply: stores per-level manualActions', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({
      configObject: makeConfigObject('batteryLow', {
        label: 'Battery incident',
        error: { severity: ICM_SEV_1, manualActions: ['DockManual'] },
        warning: { severity: ICM_SEV_2, manualActions: ['NotifyOps', 'Pause'] }
      }),
      user
    });
    const doc = await IncidentConfiguration.findOneAsync({ _id: 'batteryLow' });
    expect(doc.error.manualActions).deep.eq(['DockManual']);
    expect(doc.warning.manualActions).deep.eq(['NotifyOps', 'Pause']);
  });

  it('apply: rejects manualActions that are not an array of strings', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('bad', { error: { manualActions: [123] } }), user
      })
    ).to.be.rejected;
  });

  it('list: returns short and full formats', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject: makeConfigObject('batteryLow', VALID_SPEC), user });

    const short = await new ConfigAPI().list({ kind: KIND_INCIDENT_DEFINITION, user });
    expect(short).to.have.length(1);
    expect(short[0]).to.deep.include({ id: 'batteryLow', label: 'Battery incident', suppressed: false });

    const full = await new ConfigAPI().list({
      kind: KIND_INCIDENT_DEFINITION, id: 'batteryLow', user, format: LIST_FORMAT_FULL
    });
    expect(full[0].metadata.id).eq('batteryLow');
    expect(full[0].spec.label).eq('Battery incident');
    expect(full[0].spec.error.severity).eq(ICM_SEV_1);
  });
});
