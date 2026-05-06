/**
 * EventStore implementation for storing (and querying) events in Meteor database.
 * 
 * This is a simple store on mongodb, with the specific implementation for Meteor (a similar
 * implementation may exist for ingest and its nodejs mongodb driver).
 */
import { Meteor } from 'meteor/meteor';
// ORO modules
import EventStore from './eventStore';
import { EventLog } from './auditLogManager';

export default class DbEventStore extends EventStore {
  constructor() {
    super();
    this.events = [];
  }
  
  /**
   * Stores a batch of events. Since we do some schema validation from the DB itself, 
   * common fields are separated from the rest of the fields (which are module-dependent) and stored
   * in a blacboxed 'data' object.
   */
  storeEvents = async (dataArray) => {
    const docs = dataArray.map(({
      module, eventType, 
      userId, userName, userEmail,
      robotId, robotName,
      ts,
      ...eventData
    }) => (
      {
        module, eventType, 
        userId, userName, userEmail,
        robotId, robotName,
        ts,
        eventData // all other fields (not validated by schema) are stored in a 'data' object
      }
    ));
    await this._storeDocs(docs);
  }

  _storeDocs = async (docs) => {
    // Meteor does not have an insertMany that validates the attached SimpleSchema. 
    // So *only in development mode* we insert docs one by one, so we get schema validations 
    // and catch errors. (Note that schema validations are disabled on production anyway)
    if (Meteor.isDevelopment) {
      await Promise.all(docs.map(doc => (
        EventLog.insertAsync(doc)
      )));
    } else {
      await EventLog.rawCollection().insertMany(docs);
    }
  };

  findEvents = async ({ startTs, endTs, limit, robotId, eventType, moduleName }) => {
    if (startTs && !isFinite(startTs)) {
      throw new Error(`startTs must be a number`);
    }
    if (endTs && !isFinite(endTs)) {
      throw new Error(`endTs must be a number`);
    }
    if (robotId && !isString(robotId)) {
      throw new Error(`robotId must be a string`);
    }
    if (eventType && !isString(eventType)) {
      throw new Error(`eventType must be a string`);
    }
    if (limit && !isFinite(limit)) {
      throw new Error(`limit must be a number`);
    }
    const query = {};
    if (startTs || endTs) {
      query.ts = {};
      if (startTs) {
        query.ts.$gte = startTs;
      }
      if (endTs) {
        query.ts.$lte = endTs;
      }
    }
    if (robotId) {
      query.robotId = robotId;
    }
    if (eventType) {
      query.eventType = String(eventType)
    }
    const logs = await EventLog.find(query, { projection: { _id: 0 }, limit }).fetchAsync();
    return logs;
  }
}