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
 * useSize (AKA WidthProvider/useWidthProvider/useSizeProvider)
 * Hook to provide width and height of the referenced element.
 * The hook is responsive to resizes by creating a ResizeObserver on the container.
 * containerRef: a react ref to the element which is to be sized.
 * Return: { width, height } of the referenced element
 */
import { useEffect, useState } from 'react';
import { isArray } from 'lodash';

export default function useSize(containerRef, dependencies = []) {
  if (dependencies && !isArray(dependencies)) {
    console.error('Attempted to use non-array dependencies.', dependencies);
  }
  const [containerSize, setContainerSize] = useState(null);

  // Observe the container with a ResizeObserver and push every measured size into
  // state. The observer fires an initial callback on observe and again on every
  // resize, so this always reflects the settled size; previously the size was read
  // once via useMemo at mount and could freeze on a transient pre-layout value
  // (e.g. before a parent grid had sized the cell).
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      setContainerSize({ width: element.offsetWidth, height: element.offsetHeight });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
    // NOTE: utilizing JSON.stringify on a SHALLOW, short Array for a dependency check.
    // This is cheap compared to alternatives:
    // suggestion from here: https://twitter.com/dan_abramov/status/1104414272753487872
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, JSON.stringify(dependencies)]);

  return containerSize;
}
