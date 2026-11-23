(() => {
  "use strict";

  function createTapSound(url) {
    const media = new Audio();
    media.preload = "auto";
    media.src = url;

    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    const OfflineContextType = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let buffer;
    let context;
    let source;

    if (AudioContextType && OfflineContextType && location.protocol !== "file:") {
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error("The tap sound could not be loaded.");
          return response.arrayBuffer();
        })
        .then(bytes => new OfflineContextType(1, 1, 44100).decodeAudioData(bytes))
        .then(decoded => { buffer = decoded; })
        .catch(() => {});
    }

    function stop() {
      media.pause();
      if (!source) return;
      source.stop();
      source = null;
    }

    function play() {
      stop();
      if (buffer) {
        try {
          if (!context || context.state === "closed") context = new AudioContextType();
          // Start or resume inside the button gesture, including after an iOS interruption.
          if (context.state !== "running") context.resume().catch(() => {});
          const next = context.createBufferSource();
          next.buffer = buffer;
          next.connect(context.destination);
          next.onended = () => {
            next.disconnect();
            if (source === next) source = null;
          };
          next.start();
          source = next;
          return;
        } catch {
          // The media element can still play when Web Audio is unavailable.
        }
      }
      if (media.readyState > 0) media.currentTime = 0;
      media.play()?.catch(() => {});
    }

    return { play, stop };
  }

  const scenes = [...document.querySelectorAll("[data-scene]")];
  const steps = document.querySelectorAll("[data-step]");
  const jerseyButtons = document.querySelectorAll('[data-action="jersey"]');
  const enterCourtButton = document.querySelector('[data-action="court"]');
  const startButton = document.querySelector('[data-action="start"]');
  const shootButton = document.querySelector('[data-action="shoot"]');
  const cardButton = document.querySelector('[data-action="card"]');
  const changeJerseyButton = document.querySelector('[data-action="back"]');
  const retryButton = document.querySelector('[data-action="retry"]');
  const openCardButton = document.querySelector('[data-action="open-card"]');
  const letterButton = document.querySelector('[data-action="letter"]');
  const openLetterButton = document.querySelector('[data-action="open-letter"]');
  const replayButton = document.querySelector('[data-action="replay"]');
  const muteButton = document.querySelector('[data-action="mute"]');
  const muteLabel = document.querySelector("[data-sound-label]");
  const infoButton = document.querySelector('[data-action="info"]');
  const credits = document.querySelector("[data-credits]");
  const closeInfoButton = document.querySelector('[data-action="close-info"]');
  const gameCourt = document.querySelector("[data-court]");
  const meter = document.querySelector("[data-meter]");
  const attemptSlots = document.querySelectorAll("[data-attempt]");
  const cardContent = document.querySelector("[data-card-content]");
  const letterContent = document.querySelector("[data-letter-content]");

  const SHOT_LIMIT = 3;
  const MIN_HIT_POSITION = 42;
  const MAX_HIT_POSITION = 58;
  const METER_TRAVEL_MS = 1200;
  const SHOT_COOLDOWN_MS = 700;
  const MUTE_KEY = "kobe-arena-sound-muted";
  const tapSound = createTapSound("./assets/man.mp3");

  let activeScene = "cover";
  let jersey = "";
  let muted = false;
  let shots = [];
  let aimingSince = 0;
  let meterFrame = 0;
  let meterPosition = 0;
  let nextShotTimer = 0;

  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // The in-page toggle also works with storage blocked.
  }

  function bind(name, value) {
    document.querySelectorAll(`[data-bind="${name}"]`).forEach(element => {
      element.textContent = value;
    });
  }

  function renderSound() {
    muteButton.setAttribute("aria-pressed", String(muted));
    muteLabel.textContent = muted ? "音效关闭" : "音效开启";
  }

  function toggleMute() {
    muted = !muted;
    renderSound();
    if (muted) tapSound.stop();
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // Keep the in-page preference when storage is blocked.
    }
  }

  function setCredits(open) {
    credits.hidden = !open;
    infoButton.setAttribute("aria-expanded", String(open));
    if (open) closeInfoButton.focus({ preventScroll: true });
  }

  function closeCredits() {
    setCredits(false);
    infoButton.focus({ preventScroll: true });
  }

  function showScene(name) {
    const nextScene = scenes.find(scene => scene.dataset.scene === name);
    if (!nextScene) return;

    if (activeScene === "court" && name !== "court" && gameCourt.dataset.phase !== "complete") {
      resetRound();
    }
    activeScene = name;
    setCredits(false);
    scenes.forEach(scene => { scene.hidden = scene !== nextScene; });
    steps.forEach(step => {
      if (step.dataset.step === name) {
        step.setAttribute("aria-current", "step");
      } else {
        step.removeAttribute("aria-current");
      }
    });
    nextScene.querySelector("h1, h2")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  function chooseJersey(number) {
    jersey = number;
    document.body.dataset.jersey = number;
    jerseyButtons.forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.number === number));
    });
    enterCourtButton.disabled = !number;
    bind("jersey", number || "—");
  }

  function showPosition(position) {
    meterPosition = position;
    meter.style.setProperty("--position", `${position}%`);
  }

  function positionAt(time) {
    const distance = Math.max(0, time - aimingSince) / METER_TRAVEL_MS * 100;
    const turn = distance % 200;
    return turn <= 100 ? turn : 200 - turn;
  }

  function animateMeter(time) {
    showPosition(positionAt(time));
    meterFrame = requestAnimationFrame(animateMeter);
  }

  function renderScore() {
    const made = shots.filter(result => result === "hit").length;
    const score = made * 2;
    bind("made", made);
    bind("attempts", shots.length);
    bind("score", score);
    bind("card-summary", `${shots.length} 投 ${made} 中 · ${score} 分`);
    attemptSlots.forEach(slot => {
      const number = Number(slot.dataset.attempt);
      const result = shots[number - 1];
      if (result) {
        slot.dataset.result = result;
        slot.setAttribute("aria-label", `第 ${number} 球${result === "hit" ? "命中" : "未进"}`);
      } else {
        delete slot.dataset.result;
        slot.setAttribute("aria-label", `第 ${number} 球待投`);
      }
    });
  }

  function resetRound() {
    cancelAnimationFrame(meterFrame);
    clearTimeout(nextShotTimer);
    shots = [];
    gameCourt.dataset.phase = "ready";
    gameCourt.dataset.result = "idle";
    startButton.hidden = false;
    shootButton.hidden = true;
    shootButton.disabled = true;
    cardButton.hidden = true;
    changeJerseyButton.hidden = false;
    retryButton.hidden = true;
    showPosition(0);
    renderScore();
    bind("feedback", "开球后，等准星进入金区再出手。");
  }

  function aim(focus = false) {
    gameCourt.dataset.phase = "aiming";
    gameCourt.dataset.result = "idle";
    shootButton.hidden = false;
    shootButton.disabled = false;
    startButton.hidden = true;
    changeJerseyButton.hidden = true;
    showPosition(0);
    aimingSince = performance.now();
    meterFrame = requestAnimationFrame(animateMeter);
    if (focus) shootButton.focus({ preventScroll: true });
  }

  function shoot() {
    const position = meterPosition;
    const hit = position >= MIN_HIT_POSITION && position <= MAX_HIT_POSITION;
    const result = hit ? "hit" : "miss";
    const restoreFocus = document.activeElement === shootButton;
    cancelAnimationFrame(meterFrame);
    showPosition(position);
    shootButton.disabled = true;
    gameCourt.dataset.phase = "settling";
    gameCourt.dataset.result = result;
    shots.push(result);
    renderScore();

    const complete = shots.length === SHOT_LIMIT;
    const feedback = hit ? "空心命中！拿下 2 分。" : "球弹框而出。";
    bind("feedback", complete ? `${feedback} 三球打完，生日卡已解锁！` : feedback);

    nextShotTimer = setTimeout(() => {
      const refocus = restoreFocus && document.activeElement === document.body;
      if (complete) {
        gameCourt.dataset.phase = "complete";
        shootButton.hidden = true;
        cardButton.hidden = false;
        retryButton.hidden = false;
        if (refocus) cardButton.focus({ preventScroll: true });
      } else {
        aim(refocus);
      }
    }, SHOT_COOLDOWN_MS);
  }

  function reveal(button, content, nextButton) {
    button.hidden = true;
    content.hidden = false;
    nextButton.hidden = false;
    content.tabIndex = -1;
    content.focus();
  }

  function replay() {
    chooseJersey("");
    resetRound();
    openCardButton.hidden = false;
    cardContent.hidden = true;
    letterButton.hidden = true;
    openLetterButton.hidden = false;
    letterContent.hidden = true;
    replayButton.hidden = true;
    showScene("cover");
  }

  const actions = {
    enter: () => showScene("locker"),
    jersey: button => chooseJersey(button.dataset.number),
    court: () => {
      resetRound();
      showScene("court");
    },
    start: () => aim(true),
    shoot,
    retry: () => {
      resetRound();
      aim(true);
    },
    card: () => showScene("card"),
    "open-card": () => reveal(openCardButton, cardContent, letterButton),
    letter: () => showScene("letter"),
    "open-letter": () => reveal(openLetterButton, letterContent, replayButton),
    replay,
    mute: toggleMute,
    back: button => showScene(button.dataset.target),
    info: () => {
      if (credits.hidden) setCredits(true);
      else closeCredits();
    },
    "close-info": closeCredits
  };

  document.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled || button.closest("[hidden]")) return;
    const action = button.dataset.action;
    if (!Object.prototype.hasOwnProperty.call(actions, action)) return;

    actions[action](button);
    if (!muted) tapSound.play();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !credits.hidden) {
      closeCredits();
      if (!muted) tapSound.play();
    }
  });
  window.addEventListener("pagehide", tapSound.stop);

  chooseJersey("");
  renderSound();
  resetRound();
})();
