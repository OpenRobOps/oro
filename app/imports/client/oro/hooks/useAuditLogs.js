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
 * Hook to get Audit Log events
 */
import { useEffect } from 'react';
import { useMethod } from '../util/meteorUtils';

/**
 * Hook to obtain the Audit Logs for a the fleet or a given robot; with a time period
 *
 * @export
 * @param {*} robotId
 * @param {*} limit
 * @param {*} eventType
 * @param {*} startTs
 * @param {*} endTs
 * @return {Object}
 * {
 *   data: Object | null,
 *   isLoading: boolean,
 *   error: { error: ..., message: ... }
 * }
 */
export default function useAuditLogs({
  startTs,
  endTs,
  limit = 100,
  robotId = null,
  eventType = null,
}) {
  const { 
    data, 
    error,
    isLoading,
    call: fetchAuditLogs,
  } = useMethod('auditLogs.get');

  useEffect(() => {
    fetchAuditLogs({ startTs, endTs, limit, robotId, eventType });
  }, [robotId, startTs, endTs, eventType, limit]);

  return { data, isLoading, error };
}
