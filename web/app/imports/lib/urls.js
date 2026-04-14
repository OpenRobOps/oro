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
 * Simple class(es) to build in-app URLs.
 * Written to avoid creating the same URLs over and over with the risk of being inconsistent
 * when any route changes; centralizing the places were we need to do changes.
 *
 * TODO(herchu) Slowly migrate URLs built in other modules to use Url class.
 *
 * Example usage (from a meteor shell):
 * > import { Url } from './lib/urls'
 * > new Url().settings().tail('admin').anchor('Users').toString()
 */
import { Meteor } from 'meteor/meteor';
import { isObject, isString } from 'lodash';
import { PAGES } from '../shared/urls';
import { findDashboardWithScopes, loadDashboardsAsync } from './dashboards';

// URL to home page. Just so no other modules need to mess with Meteor url stuff
const homeUrl = () => Meteor.absoluteUrl();
// Builds a URL for the relative path prepending the site's absolute URL
const pathUrl = path => Meteor.absoluteUrl(path);

/**
  * Generates an invite url based on the given code.
  * @arg inviteCode must be a string.
  */
const getInviteUrl = inviteCode => `${pathUrl('join')}?inviteCode=${inviteCode}`;

/**
 * Parses an object to hashes mapping its keys to hashNames and values to hashValues.
 * Note: Does not add the `#` character in front of the string.
 * @param {object} anchorObj - Object with keys and values to be parsed to hashString
 * @return {string} - A string with the parsed object keys and values as hash.
 * hashObject = { max: 'fleet', query: '345' }
 * returnString = 'max=fleet&query=345'
 */
const objToHash = (anchorObj) => {
  const hashString = Object.keys(anchorObj)
    .map((key) => {
      const value = anchorObj[key];
      // Due to some anchor tags not having a value, we must check if a value is present
      const subHash = `${key}${value === undefined ? '' : ('=' + value)}`;
      return subHash;
    }).join('&');
  return hashString;
};

class Url {
  constructor() {
    this.absolute = true;
    this.page = null;
    this.collectionId = null;
    this.robotId = null;
    this.tailParts = null;
    this.queryStr = null;
    this.anchorStr = null;
  }

  /**
   * Sets a robotId for this path -- not always used
   */
  robot(robotId) {
    this.robotId = robotId;
    return this;
  }

  /**
  * Adds a 'tail' element or path.
  * @arg tailParts must be a string or array of strings.
  *
  * TODO(herchu) Would be better to add logic and validation to each part:
  * e.g. 'admin' only accepted within 'configuration', etc.
  */
  tail(tailParts) {
    this.tailParts = Array.isArray(tailParts) ? tailParts : [tailParts];
    return this;
  }

  /**
   * Builds a Url for the Mission control of a robot
   */
  // DEPRECATED
  kpi() {
    if (this.page) {
      throw new Error('Url: page is already set.');
    }
    console.error('DEPRECATED Urls.kpi() called');
    this.page = PAGES.KPI;
    return this;
  }

  /**
   * Builds a Url for the Settings or Configuration page
   */
  settings() {
    if (this.page) {
      throw new Error('Url: page is already set.');
    }
    this.page = PAGES.SETTINGS;
    return this;
  }

  /**
   * Builds a Url for the Locations page
   */
  // DEPRECATED
  locations() {
    if (this.page) {
      throw new Error('Url: page is already set.');
    }
    console.error('DEPRECATED Urls.locations() called');
    this.page = PAGES.LOCATIONS;
    return this;
  }

  /**
   * Builds a Url from api paths (api/v1/...)
   */
  api(path) {
    if (this.page) {
      throw new Error('Url: page is already set.');
    }
    this.page = 'api/v1/' + path;
    return this;
  }

  /**
   * Builds a Url for a Dashboards page.
   *
   * The `selector` argument can contain fields { id, scope } (or none).
   * If given, an `id` of a specific dashboard can be used to point to this dashboard.
   * A `scope` can also be used to select a dashboard with sections with this scope, for example
   * "robot". See `findDashboardWithScopes()` for details on how the selection is performed.
   *
   * @arg selector Optional. An object to describe what dashboard to select.
   */
  async dashboardsAsync(selector = null) {
    if (this.page) {
      throw new Error('Url: page is already set.');
    }
    this.page = PAGES.DASHBOARDS;
    // If a selection criteria for a dashboard is given, find it and append its id to the route
    const { scope, id } = selector || {}; // for now, only "scope" selector is implemented
    if (id) {
      this.tail(id);
    } else if (scope) {
      // Try to find a dashboard from config with the most sections with this scope
      const dashboards = await loadDashboardsAsync();
      const dashboard = findDashboardWithScopes(dashboards, [scope]);
      // If any dashboard was found, append it to route. Otherwise, point to default dashboard
      if (dashboard) {
        this.tail(dashboard._id);
      }
    }
    return this;
  }

  // deprecated Use dashboardsAsync instead (client-side only)
  dashboards(selector = null) {
    if (this.page) {
      throw new Error('Url: page is already set.');
    }
    this.page = PAGES.DASHBOARDS;
    // If a selection criteria for a dashboard is given, find it and append its id to the route
    const { scope, id } = selector || {}; // for now, only "scope" selector is implemented
    if (id) {
      this.tail(id);
    } else if (scope) {
      // Try to find a dashboard from config with the most sections with this scope
      const dashboards = loadDashboards();
      const dashboard = findDashboardWithScopes(dashboards, [scope]);
      // If any dashboard was found, append it to route. Otherwise, point to default dashboard
      if (dashboard) {
        this.tail(dashboard._id);
      }
    }
    return this;
  }

  // For now, a single query string provided -- might be better to
  // receive an array of key-value pairs
  query(query) {
    if (isString(query)) {
      this.queryStr = query;
    } else if (isObject(query)) {
      this.queryStr = Object.keys(query).map(k => k + '=' + query[k]).join('&');
    }
    return this;
  }

  /**
   * Appends an anchor '#xxyyzz'; given as a simple string (without leading '#');
   * or an object where keys are hash names and values are hash values. If falsy value
   * is passed, then just add the hash name.
   */
  anchor(anchorStr) {
    if (isString(anchorStr)) {
      this.anchorStr = anchorStr;
    } else if (isObject(anchorStr)) {
      this.anchorStr = objToHash(anchorStr);
    }
    return this;
  }

  /**
   * Sets this Url as relative (they are created absolute by default).
   * When relative, urls start with '/' instead of 'https://control....'
   */
  relative() {
    this.absolute = false;
    return this;
  }

  /**
   * Builds the URL as a string
   */
  toString() {
    if (!this.page) {
      throw new Error('No main page specified');
    }
    let url = this.absolute ? homeUrl() : '/';
    let path = [this.page];
    if (this.robotId) {
      path.push(this.robotId);
    }
    if (this.tailParts) {
      path = path.concat(this.tailParts);
    }
    url += path.join('/');
    if (this.queryStr) {
      url += '?' + this.queryStr;
    }
    if (this.anchorStr) {
      url += '#' + this.anchorStr;
    }
    return url;
  }
}

export {
  Url, homeUrl, getInviteUrl, PAGES
};
