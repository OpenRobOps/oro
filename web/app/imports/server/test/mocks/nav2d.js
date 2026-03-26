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
