/**
 * Ingest-side implementation of the System agent module
 */
import Robot from '../model/robot';
import AttributesManager from '../attributes';
import {
  VITAL_CPU_LOAD_PERCENTAGE,
  VITAL_RAM_USAGE_PERCENTAGE,
  VITAL_DISK_USAGE_PERCENTAGE,
  VITAL_AGENT_DISK_USAGE_PERCENTAGE,
  VITAL_AGENT_DISK_USAGE_MB,
  VITAL_NET_TOTAL_TX_RATE,
  VITAL_NET_TOTAL_RX_RATE,
  VITAL_NET_TOTAL_RATE,
  VITAL_NET_ORO_TX_RATE,
  VITAL_NET_ORO_RX_RATE,
  VITAL_NET_ORO_RATE,
  VITAL_NET_TOTAL_TX_BYTES,
  VITAL_NET_TOTAL_RX_BYTES,
  VITAL_NET_ORO_TX_BYTES,
  VITAL_NET_ORO_RX_BYTES
} from '../../shared/attributes';

// TODO Change to ES6 imports format
const Long = require('long');

const OPTION_TYPES = {
  DISK: 'disk',
  NET: 'net'
};

export default class SystemModule {
  constructor(mqtt, batchProcessing = false) {
    this.mqtt = mqtt;
    this.attrMgr = new AttributesManager();
    // Flag to identify if this module is being used in batch mode. This attribute takes relevance
    // when processing messages from rosbags in bulk. When batchProcessing is true, mongo won't be
    // updated with real time information.
    this._batchProcessing = batchProcessing;
    if (this._batchProcessing) {
      this.attrMgr.setOfflineMode(this._batchProcessing);
    }
  }

  load = () => {
    this.mqtt.registerListener('system/stats', this.onMessage);
    this.SystemStatsMessage = this.mqtt.lookupType('oro.SystemStatsMessage');
  };

  onMessage = async (robotId, msg, _packet) => {
    // NOTE(adamantivm) This is a hack to detect when the offline state
    // may be wrong / lost.
    // If we receive a message that is not a state message from a robot
    // that we either haven't listed yet or is listed as offline, then
    // ask the robot to re-iterate their online status.
    const robot = new Robot(robotId);
    const agentVer = await robot.getAgentVersion();

    try {
      // Decode the protobuf message
      const decodedMsg = this.SystemStatsMessage.decode(msg);

      // Convenience accessor for static method
      const convertRate = this.constructor.convertTransferRate;
      const ts = decodedMsg.timestamp.toNumber() || Date.now();
      const { elapsedSeconds } = decodedMsg;
      // absolute values (only meaningful when added)
      const totalTx = decodedMsg.totalTx.toNumber();
      const totalRx = decodedMsg.totalRx.toNumber();
      const oroTx = decodedMsg.oroTx.toNumber();
      const oroRx = decodedMsg.oroRx.toNumber();
      // transmit rates, can be seen as a snapshot
      const rateTotalTx = convertRate(totalTx, elapsedSeconds);
      const rateTotalRx = convertRate(totalRx, elapsedSeconds);
      const rateOroTx = convertRate(oroTx, elapsedSeconds);
      const rateOroRx = convertRate(oroRx, elapsedSeconds);
      // Also report aggregated TX and RX rate
      const rateTotal = rateTotalTx + rateTotalRx;
      const rateOro = rateOroTx + rateOroRx;

      // Prepare updates from core elements
      const updates = {
        [VITAL_CPU_LOAD_PERCENTAGE]: { value: decodedMsg.cpuLoadPercentage },
        [VITAL_DISK_USAGE_PERCENTAGE]: { value: decodedMsg.hddUsagePercentage },
        [VITAL_AGENT_DISK_USAGE_PERCENTAGE]: { value: decodedMsg.oroHddUsagePercentage },
        [VITAL_AGENT_DISK_USAGE_MB]: { value: decodedMsg.oroHddUsageMb },
        [VITAL_NET_TOTAL_TX_RATE]: { value: rateTotalTx },
        [VITAL_NET_TOTAL_RX_RATE]: { value: rateTotalRx },
        [VITAL_NET_TOTAL_RATE]: { value: rateTotal },
        [VITAL_NET_ORO_TX_RATE]: { value: rateOroTx },
        [VITAL_NET_ORO_RX_RATE]: { value: rateOroRx },
        [VITAL_NET_ORO_RATE]: { value: rateOro },
        [VITAL_NET_TOTAL_TX_BYTES]: { value: totalTx },
        [VITAL_NET_TOTAL_RX_BYTES]: { value: totalRx },
        [VITAL_NET_ORO_TX_BYTES]: { value: oroTx },
        [VITAL_NET_ORO_RX_BYTES]: { value: oroRx },
        [VITAL_RAM_USAGE_PERCENTAGE]: { value: decodedMsg.ramUsagePercentage }
      };


      // Read optional attributes, based on agentlet configuration
      decodedMsg.optionalDisksData.forEach((disk) => {
        updates[SystemModule.getAttributeKey(OPTION_TYPES.DISK, disk.volumeId)] = {
          value: disk.usagePercentage
        };
      });
      decodedMsg.optionalNetworkInterfacesData.forEach((netInterface) => {
        // transmit rates
        const rateInterfaceTx = convertRate(netInterface.tx, elapsedSeconds);
        const rateInterfaceRx = convertRate(netInterface.rx, elapsedSeconds);

        const rateInterface = rateInterfaceTx + rateInterfaceRx;
        updates[SystemModule.getAttributeKey(OPTION_TYPES.NET, netInterface.interfaceId)] = {
          value: rateInterface
        };
      });

      // Save to vitals. Also hooks status updates and events
      await this.attrMgr.handleSystemUpdates(robotId, updates, ts);
    } catch (e) {
      console.error('Error processing robot stats message', e);
    }
  };

  /**
   * Returns an attribute key to be used for this combination
   * of optional monitored element and option key (e.g.: volume).
   * This is to be used as the key for the value when sending to
   * the AttributesManager.
   */
  static getAttributeKey = (type, key) => {
    if (type == SystemModule.OPTION_TYPES.DISK) {
      return VITAL_DISK_USAGE_PERCENTAGE + '_' + key;
    } else if (type == SystemModule.OPTION_TYPES.NET) {
      return VITAL_NET_TOTAL_RATE + '_' + key;
    }
    return undefined;
  };

  // Convert an absolute bytes value and time period (seconds) to rounded kb/s
  static convertTransferRate = (x, elapsed) => {
    if (!elapsed) {
      return undefined;
    }
    const value = Long.isLong(x) ? x.toNumber() : x;
    return value / 1024 / elapsed; // formatted to kb/s
  };

  /**
   * Allow users of SystemModule to access OPTION_TYPES
   * as SystemModules.OPTION_TYPES
   */
  static OPTION_TYPES = OPTION_TYPES;
}
