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
