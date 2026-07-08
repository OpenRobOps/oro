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

import { useCallback, useSyncExternalStore } from 'react';

const MUTE_KEY = 'muteNotifications';
const CHANGE_EVENT = 'muteNotifications-change';

const isEnabled = () => localStorage.getItem(MUTE_KEY) !== 'true';

const subscribe = (onChange) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

/**
 * Reads and toggles whether the in-app incident notifications banner is shown.
 * Shared by the app header bell and the dashboard banner.
 *
 * The flag is client-side only, stored in localStorage under `muteNotifications`
 * (the same key the dashboard selector already reads), mirroring how the main
 * platform keeps this per-browser toggle. `enabled` is the inverse of muted;
 * defaults to enabled when unset. useSyncExternalStore keeps every consumer in
 * sync when the flag is toggled (same tab via a custom event, other tabs via the
 * native `storage` event).
 */
const useNotificationsEnabled = () => {
  const enabled = useSyncExternalStore(subscribe, isEnabled, () => true);

  const toggle = useCallback(() => {
    // The new muted value is the current enabled value (we are flipping it).
    localStorage.setItem(MUTE_KEY, String(isEnabled()));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { enabled, toggle };
};

export default useNotificationsEnabled;
