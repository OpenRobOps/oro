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
 * NowTime Context
 * Centralizes the value of "Now" across context users.
 * The goal is for all subscribers to the context to synchronize
 * their updates by utilizing the same now timestamp value,
 * which updates every minute.
 */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const NowTimeContext = React.createContext(Date.now());
NowTimeContext.displayName = 'nowTimeContext';

function NowTimeProvider(props) {
  const { intervalMs } = props;
  const [nowTs, setNowTs] = useState(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    let timerCancelled = false;
    /**
     * Custom Interval:
     * Sets a timer with the given timestamp, and then calls itself after the timer expires.
     * Utilizes a react ref to check if it needs to be cancelled.
     * @returns timer instance
     */
    function customInterval() {
      // Prevent the timer from re-triggering if we have unmounted
      if (timerCancelled) {
        return null;
      }
      const now = Date.now();
      setNowTs(now);
      return setTimeout(() => {
        customInterval();
      }, now + intervalMs - Date.now());
    }
    timerRef.current = customInterval();
    return () => {
      timerCancelled = true;
      clearInterval(timerRef.current);
    };
  }, [intervalMs]);

  return (
    <NowTimeContext.Provider value={nowTs} {...props} />
  );
}
NowTimeProvider.propTypes = {
  intervalMs: PropTypes.number,
};

function useNowTimeContext() {
  const context = React.useContext(NowTimeContext);
  if (context === undefined) {
    console.error('useNowTimeContext called outside of a NowTimeContext');
    // If a component attempts using the context with no provider, return null to them
    return null;
  }
  // Context is a single value: nowTs
  return context;
}

export {
  NowTimeContext,
  NowTimeProvider,
  useNowTimeContext
};
