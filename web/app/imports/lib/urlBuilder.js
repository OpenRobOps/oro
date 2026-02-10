/**
 * Url builder module.
 *
 * This intends to be a meteor free and perhaps better designed replacement
 * for the urls module. The main difference is that this module is unable to
 * build absolute urls (that is funtionality that requires Meteor).
 */

// ORO modules
import { isArray, isObject, isString } from 'lodash';
import { PAGES } from '../shared/urls';

/**
 * Generic url builder.
 * TODO(Pablo) This + specialization should replace the Url class.
 */
class UrlBuilder {
  static for(page) {
    return new UrlBuilder(page);
  }

  constructor(page) {
    if (!page) {
      throw new Error('page not specified');
    }
    this._path = [page];
    this._query = null;
    this._hash = null;
  }

  /**
   * Append the given strings to the url full path.
   *
   * @param {string} pathComponents components to add to path
   */
  appendPath(...pathComponents) {
    this._path = [...this._path, ...pathComponents];
    return this;
  }

  /**
   * Set url query params. If query is string, add it verbatim.
   * If query is an array, its element must be 2-element arrays,
   * interpreted as key-value pais. If query is an object, it
   * must have strin values for each key.
   *
   * @param {string|array|object} query query params to add to url
   */
  query(query) {
    if (isString(query)) {
      this._query = query[0] == '?' ? query.substr(1) : query;
    } else if (isArray(query)) {
      this._query = query.map(([k, v]) => `${k}=${v}`).join('&');
    } else if (isObject(query)) {
      this._query = Object.keys(query).map(k => `${k}=${query[k]}`).join('&');
    }
    return this;
  }

  /**
   * Appends a url hash. Params same as query function.
   * @param {string|array|object} hash hash params to add to url
   */
  hash(hash) {
    if (isString(hash)) {
      this._hash = hash[0] == '#' ? hash.substr(1) : hash;
    } else if (isArray(hash) || isObject(hash)) {
      const entries = isArray(hash) ? hash : Object.entries(hash);
      this._hash = entries.map(([k, v]) => `${k}${v === undefined ? '' : `=${v}`}`);
    }
    return this;
  }

  build() {
    let url = '/' + this._path.join('/');
    if (this._query) {
      url += `?${this._query}`;
    }
    if (this._hash) {
      url += `#${this._hash}`;
    }
    return encodeURI(url);
  }
}

/**
 * Url builder specialization for Dashboard urls.
 *
 * TODO(Pablo): define further specializations for
 * mc, kip, settings, and location urls.
 */
class DashboardUrl {
  constructor() {
    this._urlBuilder = new UrlBuilder(PAGES.DASHBOARDS);
  }

  company(companyId) {
    this._urlBuilder.appendPath(companyId);
    return this;
  }

  dashboard(dashboardId) {
    this._urlBuilder.appendPath(dashboardId);
    return this;
  }

  context(context) {
    this._urlBuilder.query(context);
    return this;
  }

  build() {
    return this._urlBuilder.build();
  }
}

export { DashboardUrl };
