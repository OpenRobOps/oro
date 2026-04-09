/*
 * Common module to localization data sources, including Meteor and DirectClient data.
 * It simply exports a default list of regularly used data sources, combining DB and
 * MQTT data.
 */
import {
  meteorLocalizationDataSource,
  meteorMapDataSource,
  meteorRobotDetailsSource,
  meteorRttDataSource
} from './MeteorLocalizationDataSources';
import { LOCALIZATION_DATA_TYPE } from './LocalizationDataTypes';
import { directClientLocalizationDataSource } from './MqttLocalizationDataSources';

/*
 * Define here all data sources available for components within NavigationDetail
 */
const DEFAULT_DATA_SOURCES = {
  [LOCALIZATION_DATA_TYPE.LOCALIZATION]: [
    meteorLocalizationDataSource,
    directClientLocalizationDataSource
  ],
  [LOCALIZATION_DATA_TYPE.MAP]: [meteorMapDataSource],
  [LOCALIZATION_DATA_TYPE.RTT]: [meteorRttDataSource],
  [LOCALIZATION_DATA_TYPE.DETAILS]: [meteorRobotDetailsSource]
};

export { DEFAULT_DATA_SOURCES };
