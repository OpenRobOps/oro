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
 * OAuth service configuration.
 *
 * Reads provider credentials from Meteor.settings.oauth and persists them
 * into the ServiceConfiguration collection so that accounts-google /
 * accounts-github can use them at login time.
 */
import { Meteor } from 'meteor/meteor';
import { OAuth } from 'meteor/oauth';
import { ServiceConfiguration } from 'meteor/service-configuration';

// Workaround for a bug in the Meteor github-oauth package: getEmails()
// calls /user/emails and assumes the response is always an array, but when
// the endpoint returns an error (403/404) the parsed JSON is an object,
// causing "emails.find is not a function". We patch OAuth._fetch so that
// requests to that specific URL always resolve to an array.
const _originalFetch = OAuth._fetch;
OAuth._fetch = async function (url, ...args) {
  const response = await _originalFetch.call(this, url, ...args);
  if (url === 'https://api.github.com/user/emails') {
    const origJson = response.json.bind(response);
    response.json = async () => {
      const data = await origJson();
      return Array.isArray(data) ? data : [];
    };
  }
  return response;
};

const configureOAuth = async () => {
  const oauthSettings = Meteor.settings.oauth;
  if (!oauthSettings) {
    console.warn('OAuth: No oauth settings found in Meteor.settings — login will not work');
    return;
  }

  const oauthMethodsConfigured = [];
  // Google
  if (oauthSettings.google) {
    const { clientId, secret, loginStyle } = oauthSettings.google;
    await ServiceConfiguration.configurations.removeAsync({ service: 'google' });
    await ServiceConfiguration.configurations.insertAsync({
      service: 'google',
      clientId,
      secret,
      loginStyle: loginStyle || 'popup',
    });
    oauthMethodsConfigured.push('google');
  }

  // GitHub
  if (oauthSettings.github) {
    const { clientId, secret, loginStyle } = oauthSettings.github;
    await ServiceConfiguration.configurations.removeAsync({ service: 'github' });
    await ServiceConfiguration.configurations.insertAsync({
      service: 'github',
      clientId,
      secret,
      loginStyle: loginStyle || 'popup',
    });
    oauthMethodsConfigured.push('github');
  }
  console.log('OAuth: configured with: ' + oauthMethodsConfigured.join(', '));
};

export { configureOAuth };
