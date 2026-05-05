/**
 * EventStore implementation for storing (and querying) events in Meteor database.
 * 
 * This is a simple store on mongodb, with the specific implementation for Meteor (a similar
 * implementation may exist for ingest and its nodejs mongodb driver).
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
// ORO modules
import EventStore from './eventStore';
import { COLLECTIONS } from '../../shared/constants';

// Collection (serverside only)
// TODO Consider adding an expiration index
const EventLog = new Mongo.Collection(COLLECTIONS.EVENT_LOG);
const COMMON_FIELDS = ['module', 'eventType', 'userId', 'userName', 'userEmail', 'robotId', 'robotName', 'ts']
const EventLogSchema = new SimpleSchema({
  // top level event data (mandatory)
  module: { type: String, optional: false },
  eventType: { type: String, optional: false },
  ts: { type: Number, optional: false },
  // user data (optional)
  userId: { type: String, optional: true },
  userName: { type: String, optional: true },
  userEmail: { type: String, optional: true },
  // robot data (optional)
  robotId: { type: String, optional: true },
  robotName: { type: String, optional: true },
  // module-specific data, blackbox
  data: { type: Object, optional: true, blackbox: true } 
});
if (Meteor.isDevelopment) {
  EventLog.attachSchema(EventLogSchema);
}
if (Meteor.isServer) {
  EventLog.rawCollection().createIndex({ ts: 1 });
  EventLog.rawCollection().createIndex({ module: 1, ts: 1 });
}

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
      ...data
    }) => (
      {
        module, eventType, 
        userId, userName, userEmail,
        robotId, robotName,
        ts,
        data // all other fields (not validated by schema) are stored in a 'data' object
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
}