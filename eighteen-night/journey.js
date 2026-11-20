'use strict';

const journey = document.getElementById('journey');
const stages = [...journey.querySelectorAll('.stage')];
const route = document.getElementById('route');
const routeProgress = document.getElementById('route-progress');
const stageLabel = document.getElementById('stage-label');
const seal = document.getElementById('seal-card');
const sealHint = document.getElementById('seal-hint');
const age = document.getElementById('age-reveal');
const toCake = document.getElementById('to-cake');
const cake = document.getElementById('cake');
const light = document.getElementById('light');
const blowActions = document.getElementById('blow-actions');
const blow = document.getElementById('blow');
const wishActions = document.getElementById('wish-actions');
const wishInput = document.getElementById('wish-input');
const launch = document.getElementById('launch');
const launched = document.getElementById('launched');
const wishCaption = document.getElementById('wish-caption');
const scratchTicket = document.getElementById('scratch-ticket');
const scratchPrize = document.getElementById('scratch-prize');
const scratchCanvas = document.getElementById('scratch-canvas');
const revealButton = document.getElementById('reveal-scratch');
const toLetter = document.getElementById('to-letter');
const letterIntro = document.getElementById('letter-intro');
const envelope = document.getElementById('open-letter');
const letter = document.getElementById('letter');
const letterHeading = document.getElementById('letter-heading');
const letterActions = document.getElementById('letter-actions');
const saveButton = document.getElementById('save-letter');
const saveMessage = document.getElementById('save-message');
const finale = createStarFinale(document.getElementById('star-finale'), '彬哥');

let stageIndex = 0;
let knocks = 0;
let couponRevealed = false;

function focusItem(element) {
  element.focus({ preventScroll: true });
  if (element.getBoundingClientRect().bottom > window.innerHeight) {
    element.scrollIntoView({ block: 'nearest' });
  }
}

function revealCoupon() {
  if (couponRevealed) return;
  couponRevealed = true;
  scratchTicket.classList.add('revealed');
  scratchPrize.removeAttribute('aria-hidden');
  revealButton.hidden = true;
  toLetter.hidden = false;
  focusItem(toLetter);
}

let scratch;
try {
  scratch = createScratchCard(scratchCanvas, revealCoupon);
} catch {
  scratchTicket.classList.add('fallback');
  scratchCanvas.hidden = true;
  scratch = { reset() {}, show: revealCoupon };
}

function showStage(index) {
  const target = stages[index];
  if (!target) return;
  if (stages[stageIndex].id === 'dawn') finale.stop();
  for (const stage of stages) {
    const visible = stage === target;
    stage.hidden = !visible;
    stage.classList.toggle('arriving', visible);
  }
  stageIndex = index;
  journey.dataset.current = target.id;
  route.hidden = index === 0;
  routeProgress.value = index + 1;
  stageLabel.textContent = target.dataset.name;
  if (target.id === 'coupon' && !couponRevealed) scratch.reset();
  if (target.id === 'dawn') finale.start();
  window.scrollTo(0, 0);
  const heading = target.id === 'letter-stage' && !letter.hidden ? letterHeading : target.querySelector('h1, h2');
  focusItem(heading);
}

seal.addEventListener('click', () => {
  knocks += 1;
  seal.classList.remove('tap');
  requestAnimationFrame(() => seal.classList.add('tap'));
  if (knocks < 3) {
    sealHint.textContent = `还差 ${3 - knocks} 下。`;
    return;
  }
  seal.hidden = true;
  sealHint.textContent = '';
  age.hidden = false;
  toCake.hidden = false;
  focusItem(toCake);
});

function changeCake(state) {
  cake.dataset.cake = state;
  light.hidden = state !== 'unlit';
  blowActions.hidden = state !== 'lit';
  wishActions.hidden = state !== 'wish';
  launched.hidden = state !== 'launched';
}

light.addEventListener('click', () => { changeCake('lit'); focusItem(blow); });
blow.addEventListener('click', () => { changeCake('wish'); focusItem(launch); });
launch.addEventListener('click', () => {
  const wish = wishInput.value.trim();
  wishCaption.textContent = wish ? `「${wish}」跟着灯升起来了。` : '灯升起来了。我们继续走。';
  wishInput.value = '';
  changeCake('launched');
  focusItem(launched.querySelector('button'));
});
wishInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    launch.click();
  }
});

revealButton.addEventListener('click', () => scratch.show());
let couponTap;
toLetter.addEventListener('pointerdown', event => {
  couponTap = event.pointerType === 'touch' ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
});
toLetter.addEventListener('pointerup', event => {
  const start = couponTap;
  couponTap = null;
  if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
  // Give the native click priority when a browser delivers one after scratching.
  window.setTimeout(() => {
    if (stages[stageIndex].id === 'coupon' && !toLetter.hidden) toLetter.click();
  }, 85);
});
envelope.addEventListener('click', () => {
  letterIntro.hidden = true;
  envelope.hidden = true;
  letter.hidden = false;
  letterActions.hidden = false;
  focusItem(letterHeading);
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  saveMessage.textContent = '';
  try {
    await saveKeepsake({
      recipient: letter.querySelector('.letter-to').textContent.trim(),
      title: letterHeading.textContent.trim(),
      paragraphs: [...letter.querySelectorAll('.letter-text')].map(paragraph => paragraph.textContent.trim()),
      signature: letter.querySelector('.signature').textContent.trim(),
    });
    saveMessage.textContent = '信件图片已生成，可以在浏览器下载记录里找。';
  } catch {
    saveMessage.textContent = '图片生成失败，可以截屏把信留着。';
  } finally {
    saveButton.disabled = false;
  }
});

for (const button of journey.querySelectorAll('[data-next]')) {
  const owner = button.closest('.stage');
  button.addEventListener('click', () => {
    if (owner === stages[stageIndex]) showStage(stageIndex + 1);
  });
}
document.getElementById('back').addEventListener('click', () => showStage(stageIndex - 1));
document.getElementById('restart').addEventListener('click', () => {
  knocks = 0;
  seal.hidden = false;
  seal.classList.remove('tap');
  sealHint.textContent = '敲三下，看看藏了什么。';
  age.hidden = true;
  toCake.hidden = true;
  changeCake('unlit');
  wishInput.value = '';
  couponRevealed = false;
  scratchTicket.classList.remove('revealed');
  scratchPrize.setAttribute('aria-hidden', 'true');
  revealButton.hidden = false;
  toLetter.hidden = true;
  letterIntro.hidden = false;
  envelope.hidden = false;
  letter.hidden = true;
  letterActions.hidden = true;
  saveMessage.textContent = '';
  for (const note of journey.querySelectorAll('details[open]')) note.open = false;
  showStage(0);
});
