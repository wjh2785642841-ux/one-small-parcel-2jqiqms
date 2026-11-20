function createStarFinale(canvas, name) {
  const context = canvas.getContext("2d");
  const mask = document.createElement("canvas");
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  if (!context || !maskContext) return { start() {}, stop() {} };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const warmInk = "#ffe4b5";
  const pearlInk = "#fff2dc";
  const blueInk = "#b4ccff";
  const duration = 4750;
  const label = String(name || "彬哥");
  const fontFamily = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  let active = false;
  let frame = 0;
  let startedAt;
  let scene;

  function createScene(width, height, scale) {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    mask.width = width;
    mask.height = height;

    let size = height * .59;
    maskContext.font = `700 ${size}px ${fontFamily}`;
    const measuredWidth = maskContext.measureText(label).width;
    size *= Math.min(1, width * .75 / measuredWidth);
    const font = `700 ${size}px ${fontFamily}`;
    maskContext.font = font;
    maskContext.textAlign = "center";
    const metrics = maskContext.measureText(label);
    const opticalCenter = Number.isFinite(metrics.actualBoundingBoxAscent)
      ? (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
      : size * .32;
    const baseline = height * .495 + opticalCenter;
    maskContext.fillText(label, width / 2, baseline);
    const pixels = maskContext.getImageData(0, 0, width, height).data;

    // Keep handheld and desktop layouts similarly dense, and keep the same seed on replay.
    let seed = 12469;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const step = Math.max(3.5, height / 50);
    const pointScale = Math.max(.85, Math.min(1.8, height / 225));
    const stars = [];
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const targetX = Math.round(x + (random() - .5) * step * .8);
        const targetY = Math.round(y + (random() - .5) * step * .8);
        if (pixels[(targetY * width + targetX) * 4 + 3] < 155) continue;

        stars.push({
          x: targetX,
          y: targetY,
          fromX: width * (.04 + random() * .92),
          fromY: height * (.05 + random() * .90),
          bend: (random() - .5) * height * .45,
          delay: 290 + targetX / width * 790 + random() * 300,
          time: 970 + random() * 730,
          radius: (.5 + random() * .93) * pointScale,
          shine: .42 + random() * .57,
          phase: random() * Math.PI * 2,
          color: [warmInk, pearlInk, pearlInk, blueInk][Math.floor(random() * 4)],
          flare: random() > .986
        });
      }
    }

    const dust = Array.from({ length: 42 }, () => ({
      x: width * (.03 + random() * .94),
      y: height * (.06 + random() * .87),
      radius: (.28 + random() * .55) * pointScale,
      phase: random() * Math.PI * 2
    }));

    const bursts = [
      { x: .15, y: .3, begin: 2470, reach: .18, ink: warmInk },
      { x: .85, y: .27, begin: 2750, reach: .23, ink: blueInk },
      { x: .78, y: .76, begin: 3060, reach: .19, ink: warmInk },
      { x: .23, y: .77, begin: 3290, reach: .15, ink: pearlInk }
    ].map((burst) => ({
      ...burst,
      rays: Array.from({ length: 13 }, (_, index) => ({
        angle: index / 13 * Math.PI * 2 + random() * .27,
        reach: (.55 + random() * .65) * height * burst.reach,
        radius: (.45 + random() * .8) * pointScale
      }))
    }));

    return { width, height, scale, font, baseline, stars, dust, bursts, pointScale };
  }

  function drawDot(x, y, radius) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function paint(time) {
    const { width, height, font, baseline, stars, dust, bursts, pointScale } = scene;
    const settled = time >= duration;
    context.clearRect(0, 0, width, height);

    context.fillStyle = blueInk;
    for (const speck of dust) {
      context.globalAlpha = settled ? .31 : .21 + Math.sin(time / 580 + speck.phase) * .12;
      drawDot(speck.x, speck.y, speck.radius);
    }

    const arrival = Math.min(1, Math.max(0, (time - 2040) / 700));
    const shimmer = settled ? 0 : Math.max(0, 1 - Math.abs(time - 2800) / 580);
    context.font = font;
    context.textAlign = "center";
    context.fillStyle = warmInk;
    context.globalAlpha = .12 * arrival + .11 * shimmer;
    context.fillText(label, width / 2, baseline);

    for (const star of stars) {
      const motion = Math.min(1, Math.max(0, (time - star.delay) / star.time));
      const ease = 1 - Math.pow(1 - motion, 3);
      const curve = Math.sin(ease * Math.PI);
      const x = star.fromX + (star.x - star.fromX) * ease;
      const y = star.fromY + (star.y - star.fromY) * ease + star.bend * curve;
      const twinkle = settled ? 1 : .87 + Math.sin(time / 268 + star.phase) * .13;
      context.fillStyle = star.color;
      context.globalAlpha = star.shine * twinkle * (.27 + ease * .73);
      drawDot(x, y, star.radius * (.76 + ease * .24));

      if (star.flare && motion > .92) {
        const flareSize = star.radius * (2.5 + shimmer * 2.7);
        context.globalAlpha *= .57;
        context.fillRect(x - flareSize, y - .3 * pointScale, flareSize * 2, .6 * pointScale);
        context.fillRect(x - .3 * pointScale, y - flareSize, .6 * pointScale, flareSize * 2);
      }
    }

    for (const burst of bursts) {
      const progress = (time - burst.begin) / 1050;
      if (progress < 0 || progress >= 1) continue;
      const travel = 1 - (1 - progress) ** 2;
      context.fillStyle = burst.ink;
      context.strokeStyle = burst.ink;
      for (const ray of burst.rays) {
        const dx = Math.cos(ray.angle) * ray.reach;
        const dy = Math.sin(ray.angle) * ray.reach;
        const x = burst.x * width + dx * travel;
        const y = burst.y * height + dy * travel + 13 * progress * progress;
        context.globalAlpha = (1 - progress) * .33;
        context.lineWidth = ray.radius * .7;
        context.beginPath();
        context.moveTo(x - dx * (1 - progress) * .22, y - dy * (1 - progress) * .22);
        context.lineTo(x, y);
        context.stroke();
        context.globalAlpha = (1 - progress) * .86;
        drawDot(x, y, ray.radius);
      }
    }

    context.globalAlpha = 1;
  }

  function render(now) {
    frame = 0;
    if (!active) return;
    const { width: pixelWidth, height: pixelHeight } = canvas.getBoundingClientRect();
    const width = Math.round(pixelWidth);
    const height = Math.round(pixelHeight);
    if (width < 2 || height < 2) return;

    const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (!scene || scene.width !== width || scene.height !== height || scene.scale !== scale) {
      scene = createScene(width, height, scale);
    }

    startedAt ??= now;
    const time = reducedMotion.matches ? duration : Math.min(duration, now - startedAt);
    paint(time);
    if (time < duration) queueRender();
  }

  function queueRender() {
    if (active && !frame) frame = window.requestAnimationFrame(render);
  }

  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(queueRender)
    : null;

  function stop() {
    active = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    resizeObserver?.disconnect();
    window.removeEventListener("resize", queueRender);
    reducedMotion.removeEventListener?.("change", queueRender);
  }

  function start() {
    stop();
    active = true;
    startedAt = undefined;
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", queueRender);
    reducedMotion.addEventListener?.("change", queueRender);
    queueRender();
  }

  return { start, stop };
}
