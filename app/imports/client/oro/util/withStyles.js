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

import React from 'react';
import { makeStyles } from 'tss-react/mui';
/**
 * Helper HOC to provide { classes, theme } to a component.
 * It mimics withStyles() from tss-react. However, we found that hook to NOT provide the `theme`
 * prop. So we re-implement it based on their hook (useStyles).
 *
 * Keep in mind we should only use this HACK-HOC in:
 *  - class components, AND
 *  - if we use `theme` within the component and we cannot replace it with classes or `sx` (which
 *    can use functions that receive the theme)
 *
 * Please limit the use of this HOC, and try to migrate away from withStyles entirely!
 *
 * Usage:
 *  - Create a
 *    `const style = theme => ({ class1: { properties } ....})
 *  - For a class component, use or export the wrapped version with `classes` and `theme`:
 *    const MyComponentWrapper = legacyWithStyles(MyComponentWrapper, style);
 *
 * see styles.js page in ui-gallery for examples.
 *
 * @deprecated See notes. Prefer useStyles (functional components) or withStyles (class components)
 *             and workarounds to not use `theme` object from props (e.g. sx).
 */
const legacyWithStyles = (ClassComponent, style) => {
  const useStyles = makeStyles()(style);
  return (props) => {
    const { classes, theme } = useStyles();
    return (
      <ClassComponent {...props} classes={classes} theme={theme} />
    )
  }
};

// Do not default-export; force to use this name and make it easier later to find all occurrences
// to migrate away from this
export {
  legacyWithStyles
};