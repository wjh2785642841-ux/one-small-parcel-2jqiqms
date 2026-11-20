function createScratchCard(canvas, reveal) {
  const context = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = 192;
  mask.height = 112;
  const maskContext = mask.getContext('2d', { willReadFrequently: true });
  if (!context || !maskContext) throw new Error('这个浏览器暂时无法绘制刮卡。');

  const revealThreshold = 0.43;
  const originalPointerEvents = canvas.style.pointerEvents;
  let width = 0;
  let height = 0;
  let scale = 0;
  let activePointer = null;
  let previousPoint = null;
  let frame = 0;
  let revealed = false;

  // Touches starting outside the card still scroll the page normally.
  canvas.style.touchAction = 'none';

  function paintCover() {
    if (!width || !height) return;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, width, height);
    if (revealed) return;

    const metal = context.createLinearGradient(0, 0, width, height);
    metal.addColorStop(0, '#747467');
    metal.addColorStop(0.23, '#b0ab96');
    metal.addColorStop(0.49, '#ddd5bc');
    metal.addColorStop(0.66, '#a49d86');
    metal.addColorStop(1, '#6b6b5e');
    context.fillStyle = metal;
    context.fillRect(0, 0, width, height);

    // Fine, uneven rules give the foil a brushed rather than glossy surface.
    for (let row = 1; row < height; row += 2) {
      const density = (row * 17 % 31) / 31;
      context.fillStyle = row % 3 === 0
        ? `rgba(255, 249, 226, ${0.04 + density * 0.23})`
        : `rgba(44, 43, 34, ${density * 0.13})`;
      context.fillRect(0, row, width, 1);
    }

    context.strokeStyle = 'rgba(50, 49, 39, 0.38)';
    context.lineWidth = 1;
    context.strokeRect(8, 8, Math.max(0, width - 16), Math.max(0, height - 16));
    context.fillStyle = '#343228';
    context.font = `600 ${Math.max(14, Math.min(17, width / 15))}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('刮开看看', width / 2, height / 2);

    context.globalCompositeOperation = 'destination-out';
    context.drawImage(mask, 0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return false;
    const deviceScale = Math.min(window.devicePixelRatio || 1, 3);
    if (width === bounds.width && height === bounds.height && scale === deviceScale) return false;
    width = bounds.width;
    height = bounds.height;
    scale = deviceScale;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    paintCover();
    return true;
  }

  function stopStroke(release = false) {
    const pointer = activePointer;
    activePointer = null;
    previousPoint = null;
    if (release && pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  }

  function show() {
    if (revealed) return;
    revealed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    stopStroke(true);
    context.clearRect(0, 0, width, height);
    canvas.style.pointerEvents = 'none';
    reveal();
  }

  function measureProgress() {
    frame = 0;
    if (activePointer !== null) return;
    const { data } = maskContext.getImageData(0, 0, mask.width, mask.height);
    let removed = 0;
    for (let index = 3; index < data.length; index += 4) removed += data[index];
    if (removed / (mask.width * mask.height * 255) >= revealThreshold) show();
  }

  function drawStroke(target, from, to, radius) {
    target.fillStyle = '#000';
    target.strokeStyle = '#000';
    target.beginPath();
    if (from.x === to.x && from.y === to.y) {
      target.arc(to.x, to.y, radius, 0, Math.PI * 2);
      target.fill();
      return;
    }
    target.lineWidth = radius * 2;
    target.lineCap = 'round';
    target.moveTo(from.x, from.y);
    target.lineTo(to.x, to.y);
    target.stroke();
  }

  function scratch(event) {
    const bounds = canvas.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const start = previousPoint ?? point;
    const radius = Math.max(15, Math.min(26, height * 0.18));

    context.globalCompositeOperation = 'destination-out';
    drawStroke(context, start, point, radius);
    context.globalCompositeOperation = 'source-over';
    maskContext.setTransform(mask.width / width, 0, 0, mask.height / height, 0, 0);
    drawStroke(maskContext, start, point, radius);
    maskContext.resetTransform();
    previousPoint = point;
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    stopStroke(true);
    revealed = false;
    canvas.style.pointerEvents = originalPointerEvents;
    maskContext.clearRect(0, 0, mask.width, mask.height);
    if (!resize()) paintCover();
  }

  canvas.addEventListener('pointerdown', event => {
    if (revealed || !width || activePointer !== null || event.button !== 0) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(activePointer);
    scratch(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId === activePointer) scratch(event);
  });
  for (const type of ['pointerup', 'pointercancel']) {
    window.addEventListener(type, event => {
      if (event.pointerId !== activePointer) return;
      stopStroke();
      if (!frame) frame = requestAnimationFrame(measureProgress);
    }, { capture: true });
  }
  window.addEventListener('blur', () => stopStroke(true));

  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  return { reset, show };
}
