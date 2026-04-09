/**
 * TimeStampHint context
 * Simple context to handle keeping track of a timestamp average of various data points
 * such as robot pose and cameras.
 *
 * Navigation detail specific context
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';

const TimeStampHintContext = React.createContext(0);
TimeStampHintContext.displayName = 'timeStampContext';

function TimeStampHintProvider(props) {
  const [poseTs, setPoseTs] = useState(0);
  const [cameraTsObj, setCameraTsObj] = useState({});
  const tsHint = useRef(0);

  const updateCameraTs = useCallback((id, ts) => setCameraTsObj((obj) => {
    const newObj = { ...obj };
    newObj[id] = ts;
    return newObj;
  }), []);

  const updatePoseTs = setPoseTs;

  tsHint.current = useMemo(() => {
    let sumTs = 0;
    let counter = 0;
    if (poseTs) {
      sumTs += poseTs;
      counter++;
    }
    if (cameraTsObj && Object.keys(cameraTsObj)
      && Object.keys(cameraTsObj).length > 0) {
      Object.values(cameraTsObj).forEach((camTs) => {
        sumTs += camTs;
        counter++;
      });
    }
    if (counter > 0 && sumTs > 0) {
      return Math.ceil(sumTs / counter);
    }
    return 0;
  }, [poseTs, cameraTsObj]);

  const getTsHint = useCallback(() => tsHint.current, [tsHint]);

  const value = useMemo(() => ({
    updateCameraTs,
    updatePoseTs,
    getTsHint
  }), [tsHint]);

  return (
    <TimeStampHintContext.Provider value={value} {...props} />
  );
}

function useTimeStampHintContext() {
  const context = React.useContext(TimeStampHintContext);
  if (context === undefined) {
    console.warn('useTimeStampHintContext called outside of a TimeStampHintContext');
    // Some components can call upon this method, we do not want it to crash
    // TODO: create variants for said components to prevent trying to use this method (camera view)
    return {
      updateCameraTs: undefined,
      updatePoseTs: undefined,
      getTsHint: undefined
    };
  }
  // Context should have this schema:
  // { updateCameraTs, updatePoseTs, tsHint }
  return context;
}

export {
  TimeStampHintContext,
  TimeStampHintProvider,
  useTimeStampHintContext
};
