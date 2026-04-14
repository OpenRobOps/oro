/**
 * useSize (AKA WidthProvider/useWidthProvider/useSizeProvider)
 * Hook to provide width and height of the referenced element.
 * The hook is responsive to resizes by creating a ResizeObserver on the container.
 * containerRef: a react ref to the element which is to be sized.
 * Return: { width, height } of the referenced element
 */
import { useEffect, useState, useMemo } from 'react';
import { isArray } from 'lodash';

export default function useSize(containerRef, dependencies = []) {
  if (dependencies && !isArray(dependencies)) {
    console.error('Attempted to use non-array dependencies.', dependencies);
  }
  const [resizedCount, setResizedCount] = useState(0);
  const { current } = containerRef;

  const containerSize = useMemo(() => {
    if (current) {
      const height = containerRef.current.offsetHeight;
      const width = containerRef.current.offsetWidth;
      return { width, height };
    }
    return null;
    // NOTE: utilizing JSON.stringify on a SHALLOW, short Array for a dependency check.
    // This is cheap compared to alternatives:
    // suggestion from here: https://twitter.com/dan_abramov/status/1104414272753487872
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, resizedCount, JSON.stringify(dependencies)]);

  useEffect(() => {
    if (resizedCount > 0) setResizedCount(0);
  }, [current, containerSize]);

  // On Mount, observe container resizes via ResizeObserver (handles panel resizes,
  // fullscreen transitions, and other non-window-resize events)
  useEffect(() => {
    if (!current) return undefined;
    const observer = new ResizeObserver(() => {
      setResizedCount(prevC => prevC + 1);
    });
    observer.observe(current);
    return () => observer.disconnect();
  }, [current]);

  return containerSize;
}
