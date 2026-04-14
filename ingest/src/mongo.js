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
 * MongoManager.
 *
 * Takes care of connecting to the mongo database with the configured
 * settings and getting access to the desired collections.
 */
import { MongoClient } from 'mongodb';

let instance;
export default class MongoManager {
  constructor() {
    if (!instance) {
      instance = this;
    }
    return instance;
  }

  /**
   * Configure and init the manager. It can only be used
   * after this has been called
   */
  init = async (config) => {
    const mongoOptions = config.options || { connectTimeoutMS: 5000 };
    this.client = await MongoClient.connect(
      config.url,
      mongoOptions
    );
    this.db = await this.client.db(config.db);
    console.log('Mongo driver ready. Options', mongoOptions);
  }

  /**
   * Shuts down MongoDB connection
   */
  shutdown = async () => {
    if (this.client) {
      await this.client.close();
      this.client = null;
      console.log('Mongo shutdown complete');
    }
  }

  /**
   * Gets a collection given a name.
   */
  getCollection = (name) => {
    if (!this.db) {
      throw new Error('DB not initialized');
    }
    return this.db.collection(name);
  }
}
