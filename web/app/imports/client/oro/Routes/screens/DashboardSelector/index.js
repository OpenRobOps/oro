/**
 * DashboardSelectorScreen including the dashboard selector toolbar and the actual dashboards
 */
import React, { Suspense } from 'react';
// InOrbit modules
import Loading from '../../../util/Loading';

const DashboardSelectorContainer = () => {
  return (
    "Dashboard Selector Container placeholder"
  )
}
// export const DashboardSelectorContainer = React.lazy(() => import('../../../dashboardSelector'));

const DashboardSelectorScreen = props => (
  <Suspense fallback={<Loading />}>
    <>
      <DashboardSelectorContainer
        {...props} />
    </>
  </Suspense>
);

export default DashboardSelectorScreen;
