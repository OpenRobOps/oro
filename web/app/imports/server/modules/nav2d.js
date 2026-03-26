/**
 * app-server side Navigation 2D module.
 *
 * Handles sending navigation commands to the agent.
 *
 * NOTE On the agent side, this is implemented inside the localization agentlet
 */
import { Meteor } from 'meteor/meteor';
import { loadSync } from 'protobufjs';
// TODO(adamantivm) Figure out how to import Meteor Assets
// ORO modules
// import RttManager from '../rttManager';
import InOrbitMqtt from '../mqtt';

export default class Navigation2DModule {
  load = () => {
    this.mqtt = new InOrbitMqtt();
    // eslint-disable-next-line no-undef
    const protoRoot = loadSync(Assets.absoluteFilePath('oro.proto'));
    this.Nav2DPathMessage = protoRoot.lookupType('oro.Nav2DPathMessage');
    // Allow chaining
    return this;
  }

  /**
   * Sends a goal path command to the robot.
   *
   * robotId:   String.
   * frame:     Number. Value of one of the enum options in Nav2DWaypointFrame (see oro.proto)
   * tsHint:    Number. Timestamp in milliseconds of the most recent visual cue available to the
   *            operator at the time that the command was issued.
   * waypoints: Array. Waypoints to navigate to, in order, in the following format:
   *            [{ x, y, theta }, { x, y, theta }, ...]
   */
  sendGoalPath = ({ robotId, frame, tsHint, waypoints }) => {
    // TODO(adamantivm) Validate the message is appropriate before sending

    // Compose message
    const msg = {
      tsHint, frame, waypoints
    };
    this.mqtt.publishProtobuf(robotId, 'ros/nav/goal_path', msg, this.Nav2DPathMessage);
  }

  /**
   * Sends a command to the robot to navigate to the its current pose.
   *
   * NOTE: This is a way to cancel the current navigation goal by
   * overriding it with a goal to the current's robot pose. There are
   * other possible implementations which include actually cancelling
   * a navigation goal given its ID.
   *
   * robotId:   String.
   */
  cancelNavGoal = ({ robotId }) => {
    this.mqtt.publish(robotId, 'ros/nav/goal_to_current_pose');
  }

  /**
   * Sends a nav goal command to the robot.
   *
   * @param {String} robotId - Robot ID.
   * @param {Number} executionTs - Timestamp in milliseconds of the time the navGoal
   *      action was executed.
   * @param {Object} pose - Navigation goal pose e.g. {x: 1.2, y: 2.0, theta: -0.41}
   * @return {Object} Navigation goal pose.
   */
  sendNavGoal = async ({ robotId, executionTs, pose }) => {
    // NOTE: Current protocol doesn't include the frame_id on poses,
    // so it's not transformed here. Instead, the transformed frame is returned
    // as part on `sublocationToRobotWorldTransformation`. This is a limitation that
    // prevents sending navigation goals to a different frame/map.
    const payload = executionTs + '|' + pose.x + '|' + pose.y + '|' + pose.theta;

    console.log(`sendNavGoal: Publish ros/loc/nav_goal`, payload);
    const result = await this.mqtt.publishAsync(robotId, 'ros/loc/nav_goal', payload);
    // TODO record timing
    // new RttManager().recordTiming(robotId, result);

    return pose;
  }

  /**
   * Publishes a command on mqtt ros/loc/{command} to the robot of robotId with
   * the payload generated with the pose passed in action.elementValues
   * @param {object} action - action with the new pose on action.elementValues
   * @param {string} robotId
   * @param {string} command - string with the command to be called on the ros/loc publish
   */
  rosLocalizationPublish = async ({ command, robotId, deltaPose }) => {
    const timestamp = Date.now();
    const p = deltaPose;
    const payload = timestamp + '|' + p.x + '|' + p.y + '|' + p.theta;
    // Take the opportunity to record RTT to the robot
    // TOOD Move this to some other generic place
    console.log(`rosLocalizationPublish: Publish ros/loc/${command}`, payload);
    const result = await this.mqtt.publishAsync(robotId, `ros/loc/${command}`, payload);
    // TODO record timing
    // await new RttManager().recordTiming(robotId, result);
    return { ...result, ok: true };
  };  
}
