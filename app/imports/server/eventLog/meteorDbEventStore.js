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
}