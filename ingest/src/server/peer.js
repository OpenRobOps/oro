/**
 * Wrapper to perform peer API requests to the application server
 */
import axios from 'axios';

let instance;
export default class PeerClient {
  constructor() {
    // Singleton Pattern
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Make the Peer API ready to be used.
   */
  init = async (peerConfig) => {
    // Find and configure the peer api server. Give preference to `service` field
    // for k8s autodiscovery. If found, it uses the virtual IP of that service
    // from environment variables.
    // When not given, use (if available) the URL from configuration, which likely
    // includes a real domain name and goes through external network interfaces.
    if (peerConfig.service) {
      const hostVar = peerConfig.service + '_SERVICE_HOST';
      console.log('Configuring peer API against service: ' + peerConfig.service
        + ', using variable ' + hostVar + ' = ' + process.env[hostVar]);
      if (!process.env[hostVar]) {
        throw new Error('Env var ' + hostVar + ' not found or without value');
      }
      this.url = `http://${process.env[hostVar]}:80`;
    } else if (peerConfig.url) {
      console.log('Configuring peer API from url: ' + peerConfig.url);
      this.url = peerConfig.url;
    } else {
      throw new Error('Unable to configure peer API; unknown config');
    }
    // Removing trailing '/' if found: URLs like "http://x.y.z.w:80//peer/robot/mode"
    // will fail!
    if (this.url.substr(this.url.length - 1) == '/') {
      this.url = this.url.substr(0, this.url.length - 1);
    }
    console.log(`Peer api configured: ${this.url}`);
    this.peerKey = peerConfig.peerKey;
  };

  createAlert = async (params) => {
    if (!this.url) {
      throw new Error('Peer client not initialized');
    }
    params.peerKey = this.peerKey;
    try {
      const res = await axios.post(this.url + '/peer/alerts', params);
      return res;
    } catch (e) {
      console.error(`Error on createAlert peer call: ${e.message}`);
      throw new Error('Error when executing POST request to /peer/alerts');
    }
  };

  resolveAlert = async (params) => {
    if (!this.url) {
      throw new Error('Peer client not initialized');
    }
    params.peerKey = this.peerKey;
    params.resolve = true;
    try {
      const res = await axios.post(this.url + '/peer/alerts', params);
      return res;
    } catch (e) {
      console.error(`Error on resolveAlert peer call: ${e.message}`);
      throw new Error('Error when executing POST request to /peer/alerts');
    }
  };

  robotCommand = async (params) => {
    if (!this.url) {
      throw new Error('Peer client not initialized');
    }
    params.peerKey = this.peerKey;
    return axios.post(this.url + '/peer/robot/command', params);
  };

  /**
   * Triggers a call to peer API to update a robot's Mode.
   * The API call receives a robotId, modeId and an attribute `value` that gets
   * compared to the list of valid modes to determine the next Mode to set the
   * robot to.
   * This call is triggered by handling data source updates in AttributesManager.
   *
   * Note that arguments are not checked here but in the API handler instead.
   */
  updateRobotMode = async (params) => {
    if (!this.url) {
      throw new Error('Peer client not initialized');
    }
    params.peerKey = this.peerKey;
    return axios.post(this.url + '/peer/robot/mode', params);
  };
}
