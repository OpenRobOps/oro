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
 * React wrapper for `nipplejs`
 *
 * Wraps nipplejs joystick creation in a function component using hooks.
 * Recreates the joystick when options change; uses a callback ref to avoid
 * stale closures on event handlers.
 */
import { useRef, useEffect } from 'react';
import nipplejs from 'nipplejs';
import PropTypes from 'prop-types';

const EVENT_MAP = [
  ['start', 'onStart'],
  ['end', 'onEnd'],
  ['move', 'onMove'],
  ['dir', 'onDir'],
  ['plain', 'onPlain'],
  ['shown', 'onShown'],
  ['hidden', 'onHidden'],
  ['pressure', 'onPressure']
];

const NippleJoystick = ({
  className,
  options,
  static: isStatic,
  onCreated,
  onDestroy,
  onStart,
  onEnd,
  onMove,
  onDir,
  onPlain,
  onShown,
  onHidden,
  onPressure,
  ...divProps
}) => {
  const containerRef = useRef(null);
  const callbacksRef = useRef({});

  // Keep callbacks current so event handlers never close over stale props
  callbacksRef.current = {
    onStart, onEnd, onMove, onDir,
    onPlain, onShown, onHidden, onPressure,
    onCreated, onDestroy
  };

  const optionsKey = JSON.stringify(options);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const joystickOptions = { zone: el, ...options };
    if (isStatic) {
      joystickOptions.mode = 'static';
      joystickOptions.position = { top: '50%', left: '50%' };
    }

    const joystick = nipplejs.create(joystickOptions);

    EVENT_MAP.forEach(([event, prop]) => {
      joystick.on(event, (evt, data) => {
        callbacksRef.current[prop]?.(evt, data);
      });
    });

    callbacksRef.current.onCreated?.(joystick);

    return () => {
      joystick.destroy();
      callbacksRef.current.onDestroy?.();
    };
  }, [optionsKey, isStatic]);

  const classes = ['NippleJoystick', className].filter(Boolean).join(' ');
  return <div {...divProps} ref={containerRef} className={classes} />;
}

NippleJoystick.propTypes = {
  className: PropTypes.string,
  static: PropTypes.bool,
  onStart: PropTypes.func,
  onEnd: PropTypes.func,
  onMove: PropTypes.func,
  onDir: PropTypes.func,
  onPlain: PropTypes.func,
  onShown: PropTypes.func,
  onHidden: PropTypes.func,
  onPressure: PropTypes.func,
  onCreated: PropTypes.func,
  onDestroy: PropTypes.func,
  options: PropTypes.shape({
    color: PropTypes.string,
    size: PropTypes.number,
    threshold: PropTypes.number,
    fadeTime: PropTypes.number,
    multitouch: PropTypes.bool,
    maxNumberOfNipples: PropTypes.number,
    dataOnly: PropTypes.bool,
    position: PropTypes.object,
    mode: PropTypes.string,
    restJoystick: PropTypes.bool,
    restOpacity: PropTypes.number,
    catchDistance: PropTypes.number,
    lockX: PropTypes.bool,
    lockY: PropTypes.bool,
    shape: PropTypes.string,
    dynamicPage: PropTypes.bool
  })
};

export default NippleJoystick;
