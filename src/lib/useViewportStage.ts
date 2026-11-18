import { useEffect, useState } from 'react';
import { isMobileViewport, lensRadiusForViewport, sceneStickerScale } from './viewport';

export function useViewportStage(requestedRadius: number) {
  const [state, setState] = useState(() => ({
    radius: requestedRadius,
    stickerScale: 1,
    mobile: false,
    width: 1280,
    height: 800,
  }));

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setState({
        radius: lensRadiusForViewport(requestedRadius, width, height),
        stickerScale: sceneStickerScale(width),
        mobile: isMobileViewport(width),
        width,
        height,
      });
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [requestedRadius]);

  return state;
}