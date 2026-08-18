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
 * Hook to fetch audit log events via the auditLogs.get method.
 *
 * Distinguishes a *reset* (the query the user asked for changed — new robot,
 * filter, or time window) from a *refresh* (the same live query re-run because
 * NowTimeContext ticked to a newer clock). Both re-fetch, but only a reset
 * reports isLoading, so widgets blank to their loading state on genuine query
 * changes while live refreshes keep displaying the current rows until the new
 * response replaces them in place.
 */
import { useEffect, useRef } from 'react';
import { useMethod } from '../util/meteorUtils';

export default function useAuditLogs({
  startTs,
  endTs,
  limit = 100,
  robotId = null,
  eventType = null,
  // Whether the time window is in "live" mode: startTs/endTs then advance on
  // every NowTimeContext tick without the query meaningfully changing
  live = false,
  // Span of the time window; part of the reset key so resizing the window
  // shows the loading state even while live
  timeRangeMs = null,
}) {
  const {
    data,
    error,
    isLoading,
    call: fetchAuditLogs,
  } = useMethod('auditLogs.get');

  // Key of the user-controlled query inputs. In live mode startTs/endTs are
  // derived from the ticking clock, so they only participate for fixed windows.
  const resetKey = JSON.stringify([
    robotId, eventType, limit, timeRangeMs, live,
    ...(live ? [] : [startTs, endTs]),
  ]);
  const lastResetKeyRef = useRef(null);
  const isRefreshRef = useRef(false);

  useEffect(() => {
    isRefreshRef.current = lastResetKeyRef.current === resetKey;
    lastResetKeyRef.current = resetKey;
    fetchAuditLogs({ startTs, endTs, limit, robotId, eventType });
  }, [robotId, startTs, endTs, eventType, limit, resetKey]);

  return {
    data,
    // Hide the in-flight state during live refreshes: the previous rows stay
    // on screen and are replaced when the response arrives
    isLoading: isLoading && !isRefreshRef.current,
    error,
  };
}
