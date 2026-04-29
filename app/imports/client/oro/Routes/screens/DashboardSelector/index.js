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
 * DashboardSelectorScreen including the dashboard selector toolbar and the actual dashboards
 */
import React, { Suspense } from 'react';
import { useParams } from 'react-router';
// ORO modules
import Loading from '../../../util/Loading';

export const DashboardSelectorContainer = React.lazy(() => import('../../../dashboardSelector'));

const DashboardSelectorScreen = props => {
  // pass initial dashboardId obtained from URL
  const { dashboardId } = useParams();
  return (
    <Suspense fallback={<Loading />}>
      <>
        <DashboardSelectorContainer
          urlDashboardId={dashboardId}
          {...props} />
      </>
    </Suspense>
  )
};

export default DashboardSelectorScreen;
