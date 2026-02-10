/**
 * Fullscreen Context
 *
 * The goal of the fullscreen context is to allow setting one container to be in
 * fullscreen mode or out of fullscreen mode from anywhere in the dom tree.
 *
 * To utilize:
 * - Add FullscreenProvider to the dom tree.
 *    should be a parent component to any setters or users of context.
 *    For a current example see it's use in Dashboards + NavigationDetail
 * - Utilize useFullscreenContext: this hook has 4 properties to utilize with this context.
 *   * isFullscreen: boolean, to indicate whether container is fullscreen or not
 *   * toggleFullscreen: function, when called toggles fullscreen for the current container
 *   * containerRef: object, the current react Ref of the container to be fullscreened
 *   * setContainerRef: function, a react setState equivalent function to set the container ref
 *
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';

const FullscreenContext = React.createContext(null);
FullscreenContext.displayName = 'fullscreenContext';

function _toggleFullscreen(elementRef, setFullscreenState) {
  // get element to be made into fullscreen
  if (elementRef == null || elementRef.current == null) {
    return;
  }
  const element = elementRef.current;

  // if already in fullscreen, exit fullscreen
  if (document.fullscreenElement) {
    document.exitFullscreen();
    setFullscreenState(false);
    return;
  }
  // When the openFullscreen() function is executed, open the element in fullscreen.
  // refixes included for different browser support
  if (element.requestFullscreen) {
    setFullscreenState(true);
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) { /* Safari */
    setFullscreenState(true);
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) { /* IE11 */
    setFullscreenState(true);
    element.msRequestFullscreen();
  }
}

function _setFullscreenState(setStateCb) {
  return function () {
    setStateCb(Boolean(document.fullscreenElement));
  };
}

/**
 * Context provider. It keeps an internal state, which is the value of the
 * context, and provides a dispatch function responsible for mutating this
 * context.
 */
function FullscreenProvider(props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerRef, setContainerRef] = useState(null);

  const toggleFullscreen = useCallback(() => {
    _toggleFullscreen(containerRef, setIsFullscreen);
  }, [containerRef]);

  const value = useMemo(() => ({
    isFullscreen,
    toggleFullscreen,
    containerRef,
    setContainerRef
  }), [isFullscreen, toggleFullscreen, containerRef, setContainerRef]);

  useEffect(() => {
    const callback = _setFullscreenState(setIsFullscreen);
    document.addEventListener('fullscreenchange', callback);

    return () => document.removeEventListener('fullscreenchange', callback);
  }, []);

  return (
    <FullscreenContext.Provider value={value} {...props} />
  );
}

function useFullscreenContext() {
  const context = React.useContext(FullscreenContext);
  if (context === undefined) {
    throw new Error('useFullscreenContext must be used within a FullscreenProvider');
  }
  // Context should have this schema:
  // { isFullscreen, toggleFullscreen, containerRef, setContainerRef }
  return context;
}

export {
  useFullscreenContext,
  FullscreenProvider,
  FullscreenContext
};
