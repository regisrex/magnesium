import { useCallback, useRef, useState } from 'react';

/* const { ref, exec, state, snapshot, busy } = useChalkBoard();
   <ChalkBoard ref={ref} onIdle={...} /> */
export default function useChalkBoard() {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const exec = useCallback(async (commands) => { setBusy(true); try { return await ref.current.exec(commands); } finally { setBusy(ref.current ? ref.current.busy() : false); } }, []);
  const run = useCallback(async (script) => { setBusy(true); try { return await ref.current.run(script); } finally { setBusy(ref.current ? ref.current.busy() : false); } }, []);
  const state = useCallback(() => ref.current && ref.current.state(), []);
  const snapshot = useCallback((t, q) => ref.current && ref.current.snapshot(t, q), []);
  const clear = useCallback(() => ref.current && ref.current.clear(), []);
  return { ref, exec, run, state, snapshot, clear, busy };
}
