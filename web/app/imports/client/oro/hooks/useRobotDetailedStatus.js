import { useCallback } from 'react';
import moment from 'moment';
import useMethod from './useMethod';

const useRobotDetailedStatus = () => {
  const { execute } = useMethod('status.getDetailedStatus');

  return useCallback(({ robotId, attributeId, cb }) => {
    execute({ robotId })
      .then(status => {
        const st = status?.[attributeId];
        if (st?.message) {
          let { message } = st;
          if (st.ts) {
            message += ` (Last reported ${moment(st.ts).fromNow()})`;
          }
          cb(message);
        } else {
          cb('No status data available');
        }
      })
      .catch(err => {
        console.error('Error on status.getDetailedStatus', err);
        cb(null);
      });
  }, [execute]);
};

export default useRobotDetailedStatus;
