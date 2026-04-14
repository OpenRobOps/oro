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
 * Initializes the DB with some defaults for data sources, dashboards, etc.
 * Configuration is given in YAML files to use the (public) Config API.
 * 
 * Current version fetches all YAML files from Meteor's private/bootstrap folder.
 * 
 * It imports data only if there are no objects of a kind at all. If at least one object
 * exists, it is assumed that even if there is newer data in the YAML files, the configuration
 * has already been customized so it will not import (and overwrite) any data.
 * 
 * TODO: Add configs for objects without a config api implemented:
 *  - dashboards
 *  - actions
 * 
 */
import yaml from 'js-yaml';

const ORO_USER = { _id: 'oro' };

/**
 * Imports all objects from a YAML file.
 * The objects must all be from the same `kind`.
 */
const importDefaultKindData = async (configApi, kind) => {
  // Load the startup data file for this kind
  let fileContents;
  try {
    fileContents = await Assets.getTextAsync(`bootstrap/${kind}.yaml`);
  } catch (error) {
    // No data for this kind; ignore
    return;
  }
  await importKindData(configApi, kind, fileContents);
}

/**
 * Imports all objects from a YAML file, already loaded onto a `fileContents` string.
 * The objects must all be from the same `kind`.
 */
const importKindData = async (configApi, kind, fileContents) => {
  let data;
  try {
    data = yaml.loadAll(fileContents);
  } catch (error) {
    console.error(`bootstrap(${kind}): Error parsing YAML`, error);
    return;
  }
  console.log(`bootstrap(${kind}): loading ${data.length} items`);
  const results = await Promise.all(data.map(object => importKindObject(configApi, kind, object)));
  const failed = results.filter(result => !result);
  if (failed.length > 0) {
    console.error(`bootstrap(${kind}): ${failed.length} objects failed to import`);
    return false;
  }
}

/**
 * Imports a single configuration object (read from bootstrap YAML files) into the DB through Config API.
 * Basic sanity checks are performed (which would be done by the Config API anyway), mostly to detect
 * errors in YAML files configurations -- which we force to be organized as one kind per YAML file.
 * 
 * @returns true if the object was imported successfully, false otherwise
 */
const importKindObject = async (configApi, kind, object) => {
  // Sanity check: verify each object has a metadata, the correct kind and some spec
  if (!object.metadata) {
    console.error(`bootstrap(${kind}): Object has no metadata`, object);
    return false;
  }
  if (!object.metadata.kind) {
    // To simplify the YAML file, make kind optional - it gets it from the filename (it must match anyway)
    object.metadata.kind = kind;
  }
  if (object.metadata.kind !== kind) {
    console.error(`bootstrap(${kind}): Object has kind ${object.metadata.kind}, expected ${kind}`, object);
    return false;
  }
  if (!object.spec) {
    console.error(`bootstrap(${kind}): Object has no spec`, object);
    return false;
  }
  try { 
    await configApi.apply({ configObject: object, user: ORO_USER });
  } catch (error) {
    console.error(`bootstrap(${kind}): Error applying object ${object._id}: ${error.message}`);
    return false;
  }
  return true;
}

const bootstrapConfigData = async (configApi) => {
  console.log('Checking bootstrap data.');
  // Resolve the path of the private folder (Meteor resolves it; it works differently on a build)
  const kinds = configApi.getKinds();
  for (const kind of kinds) {
    // Query for objects of this kind. If any object exists, skip loading initial data
    const objects = await configApi.list({ kind, user: ORO_USER });
    if (objects.length > 0) {
      console.log(`bootstrap(${kind}): ${objects.length} objects already exist; skipping`);
      continue;
    }
    await importDefaultKindData(configApi, kind);
  }
}

export {
  importKindData,
  importDefaultKindData,
  bootstrapConfigData,
}