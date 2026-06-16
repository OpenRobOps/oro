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
 * Small browser helpers for copying text to the clipboard and downloading a
 * JSON file. Used by the API keys "reveal" dialog, but generic.
 */

/**
 * Copy text to the clipboard. Rejects if the Clipboard API is unavailable
 * (e.g. an insecure, non-localhost context) so callers can offer a fallback.
 * @param {string} text
 * @returns {Promise<void>}
 */
const copyToClipboard = async (text) => {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable');
  }
  await navigator.clipboard.writeText(text);
};

/**
 * Trigger a download of `obj` serialized as pretty JSON.
 * @param {string} filename Suggested file name
 * @param {Object} obj Serializable object
 */
const downloadJson = (filename, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export { copyToClipboard, downloadJson };
