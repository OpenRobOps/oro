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

/*
 * Mock implementation for Nav2D module in server/modules/nav2d
 */
import { cloneDeep } from 'lodash';

export default class Navigation2DModuleMock {
  _messagesSent = 0;

  _lastMessageSent = null;

  constructor() {
    this.reset();
  }

  reset() {
    this._messagesSent = 0;
    this._lastMessageSent = null;
  }

  sendGoalPath = (args) => {
    this._messagesSent++;
    this._lastMessageSent = cloneDeep(args);
  }

  getMessagesCount = () => this._messagesSent;

  getLastMessageSent = () => this._lastMessageSent;

  sendNavGoal = async (args) => {
    this._messagesSent++;
    this._lastMessageSent = cloneDeep(args);
  }
}
