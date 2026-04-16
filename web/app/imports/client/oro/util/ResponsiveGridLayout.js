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
 * ResponsiveGridLayout
 * Wrapper for the Responsive component from react-grid-layout
 *
 * There is a bug in the library that causes a crash when any children is null
 * With this wrapper filtering children we prevent that bug.
 * https://github.com/react-grid-layout/react-grid-layout/issues/943
 *
 * Filtering is done in 2 ways:
 * - Looks for null/undefined values and removes them from the null list
 * - Takes an array of keys to be filtered, if a child has one of said keys
 */
import React from 'react';
import PropTypes from 'prop-types';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Responsive } from 'react-grid-layout';

export default function ResponsiveGridLayout(props) {
  const { children, hiddenKeys } = props;
  let newChildren = children;
  if (Array.isArray(children)) {
    newChildren = children.filter((child) => {
      if (!child) {
        return false;
      }
      if (Array.isArray(hiddenKeys) && hiddenKeys.includes(child.key)) {
        return false;
      }
      return true;
    });
  } else {
    newChildren = children || undefined;
  }
  return (
    <Responsive {...props}>
      {newChildren}
    </Responsive>
  );
}

ResponsiveGridLayout.propTypes = {
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  hiddenKeys: PropTypes.array
};
