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
