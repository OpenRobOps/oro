/**
 * DashboardSelectorScreen including the dashboard selector toolbar and the actual dashboards
 */
import React, { Suspense } from 'react';
// ORO modules
import Loading from '../../../util/Loading';

export const DashboardSelectorContainer = React.lazy(() => import('../../../dashboardSelector'));

const DashboardSelectorScreen = props => (
  <Suspense fallback={<Loading />}>
    <>
      <DashboardSelectorContainer
        {...props} />
    </>
  </Suspense>
);

export default DashboardSelectorScreen;
