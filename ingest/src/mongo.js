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
