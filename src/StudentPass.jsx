import React, { useEffect, useRef } from 'react';

export function StudentPass() {
  return <div className="student-pass" aria-hidden="true">
    <img src="/attendance-pass.png" alt="" className="pass-fallback" />
    <canvas className="pass-canvas" width="1" height="1" />
  </div>;
}

// One live WebGL scene follows the focused course; neighbours use cached frames.
export function useStudentPass(worldRef, reducedMotion, active = true) {
  const sceneRef = useRef(null);
  const stateRef = useRef({ reducedMotion, active });
  stateRef.current = { reducedMotion, active };
  useEffect(() => {
    let cancelled = false;
    let dispose;
    import('./passScene.js').then(({ createPassScene }) => {
      if (!cancelled && worldRef.current) {
        dispose = createPassScene(worldRef.current, stateRef.current.reducedMotion);
        sceneRef.current = dispose;
        dispose.setActive(stateRef.current.active);
      }
    }).catch(() => { /* The locally rendered image remains visible without WebGL. */ });
    return () => { cancelled = true; dispose?.(); sceneRef.current = null; };
  }, [worldRef]);
  useEffect(() => {
    sceneRef.current?.setMotion(reducedMotion);
    sceneRef.current?.setActive(active);
  }, [active, reducedMotion]);
}
