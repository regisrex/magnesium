import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import BoardWriter from './BoardWriter.js';

/* <ChalkBoard ref={boardRef} width={1920} height={1080} board="green" />
   boardRef.current.exec(commands)  -> queued; resolves when those commands finish drawing
   boardRef.current.run(scriptText) -> the line-based script format
   boardRef.current.state()         -> pen, marks, free regions (for a text agent)
   boardRef.current.snapshot()      -> PNG data URL (for a vision agent)
   boardRef.current.clear() / stop() / isFree(x,y,w,h) / findFree(w,h) / board (raw BoardWriter) */
const ChalkBoard = forwardRef(function ChalkBoard(props, ref) {
  const {
    width = 1920, height = 1080, board = 'green', chalk = true, avoid = true,
    size = 36, color = 'white', speed = 1, font = 'Kalam, cursive', loadFont = true, loadMathJax = true,
    showPen = true, showOccupancy = false, mode = 'none',        // mode: 'none' | 'place' | 'draw'
    onReady, onIdle, onError, className, style
  } = props;

  const canvasRef = useRef(null), overlayRef = useRef(null), measureRef = useRef(null);
  const bw = useRef(null), queue = useRef(Promise.resolve()), pending = useRef(0), raf = useRef(0);

  useEffect(() => {
    const b = new BoardWriter(canvasRef.current, { size, board, chalk, avoid, color, speed, font, measure: measureRef.current });
    bw.current = b;
    const ready = Promise.all([loadFont ? BoardWriter.loadFont(font.split(',')[0].trim()) : null, loadMathJax ? BoardWriter.loadMathJax() : null]);
    ready.then(() => onReady && onReady(handle()), e => onError && onError(e));
    queue.current = ready.catch(() => {});
    const draw = () => {
      const ov = overlayRef.current; if (!ov) return;
      const g = ov.getContext('2d'); g.clearRect(0, 0, ov.width, ov.height);
      if (showOccupancy) {
        g.fillStyle = 'rgba(255,80,80,0.28)';
        for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) if (b.occ[r * b.cols + c]) g.fillRect(c * b.cell, r * b.cell, b.cell, b.cell);
      }
      if (showPen) {
        const t = b.tip;
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; g.beginPath(); g.arc(t.x, t.y, 6, 0, 7); g.stroke();
        g.fillStyle = b.pen.color; g.beginPath(); g.arc(t.x, t.y, 2.5, 0, 7); g.fill();
      }
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf.current); b.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useEffect(() => { const b = bw.current; if (!b) return; b.chalk = chalk && board !== 'plain'; b.setBoard(board); }, [board, chalk]);
  useEffect(() => { if (bw.current) bw.current.avoid = avoid; }, [avoid]);
  useEffect(() => { if (bw.current) bw.current.speed = speed; }, [speed]);
  useEffect(() => { if (bw.current) bw.current.size(size); }, [size]);
  useEffect(() => { if (bw.current) bw.current.color(color); }, [color]);

  // Serial queue: agents may call exec() again before the previous batch finishes.
  const enqueue = (fn) => {
    pending.current++;
    const p = queue.current.then(fn).catch(e => { onError && onError(e); }).finally(() => { if (--pending.current === 0 && onIdle) onIdle(); });
    queue.current = p;
    return p;
  };

  const handle = () => ({
    get board() { return bw.current; },
    exec: (commands) => enqueue(() => bw.current.exec(Array.isArray(commands) ? commands : commands.commands || [])),
    run: (script) => enqueue(() => bw.current.run(script)),
    clear: () => { bw.current.stop(); return enqueue(() => bw.current.clear()); },
    stop: () => bw.current.stop(),
    state: () => bw.current.state(),
    snapshot: (type, q) => bw.current.snapshot(type, q),
    isFree: (x, y, w, h) => bw.current.isFree(x, y, w, h),
    findFree: (w, h, o) => bw.current.findFree(w, h, o),
    busy: () => pending.current > 0
  });
  useImperativeHandle(ref, handle, []);

  // Optional direct interaction for a human in the room.
  const drawing = useRef(null);
  const toBoard = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * width, y: (e.clientY - r.top) / r.height * height }; };
  const onDown = (e) => {
    if (mode === 'none') return; e.currentTarget.setPointerCapture(e.pointerId);
    const p = toBoard(e);
    if (mode === 'place') { bw.current.at(p.x, p.y); bw.current.wrap(width - 60); } else drawing.current = p;
  };
  const onMove = (e) => {
    if (!drawing.current) return; const p = toBoard(e);
    if (Math.hypot(p.x - drawing.current.x, p.y - drawing.current.y) > 1.5) { bw.current.strokeTo(drawing.current.x, drawing.current.y, p.x, p.y); drawing.current = p; }
  };
  const onUp = () => { drawing.current = null; };

  const layer = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' };
  return (
    <div className={className} style={{ position: 'relative', aspectRatio: `${width} / ${height}`, ...style }}>
      <canvas ref={canvasRef} width={width} height={height} style={layer} />
      <canvas ref={overlayRef} width={width} height={height} style={{ ...layer, touchAction: 'none', cursor: mode === 'place' ? 'crosshair' : mode === 'draw' ? 'cell' : 'default' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      <div ref={measureRef} style={{ position: 'absolute', left: -20000, top: 0, visibility: 'hidden' }} />
    </div>
  );
});

export default ChalkBoard;
