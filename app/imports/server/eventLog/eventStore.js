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
 * Interface for event stores.
 * It only defines the only method necessary for sending _batches_ of events
 * and querying logs.
 */
export default class EventStore {
  /** 
   * Subclasses may implement their own shutdown (e.g. flush pending events)
   */
  shutdown = async () => {
    // Blank.
  }

  /**
   * Sends an individual event. Since most APIs will be more efficient at
   * writing batches of events, this one is implemented as a a call to storeEvents.
   */
  storeEvent = async data => this.storeEvents([data]);

  /**
   * Stores a batch of events. 
   * Subclasses must implement this single method. They can also opt to batch
   * events even more (ie. add those events to a queue)
   */
  storeEvents = async (dataArray) => {
    throw new Error('Not implemented');
  };
}