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
 * AvatarInitials: Shows the user's photo when `src` is provided;
 * otherwise falls back to up to two uppercase initials derived from `name`.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { isEmpty, isString } from 'lodash';
import { Avatar } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()(theme => ({
  avatar: {
    backgroundColor: theme.palette.background.chip,
    color: theme.palette.text.subtle,
    fontFamily: theme.fontFamily.ui,
    fontWeight: 700,
    lineHeight: 1,
  },
}));

const AvatarInitials = ({ name, src, size = 36, className }) => {
  const { classes, cx } = useStyles();
  // filter(Boolean) drops empty entries so a whitespace-only `name`
  // (e.g. "   ") doesn't yield a `[""]` array and crash on `[0][0]`.
  const words = isString(name) ? name.trim().split(/\s+/).filter(Boolean) : [];
  let initials = '?';
  if (!isEmpty(words)) {
    initials = words.length === 1
      ? words[0][0]
      : words[0][0] + words[words.length - 1][0];
    initials = initials.toUpperCase();
  }
  return (
    <Avatar
      src={src || undefined}
      className={cx(classes.avatar, className)}
      sx={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {!src && initials}
    </Avatar>
  );
};

AvatarInitials.propTypes = {
  name: PropTypes.string,
  src: PropTypes.string,
  size: PropTypes.number,
  className: PropTypes.string,
};

export default AvatarInitials;
