'use strict';

const scenes = {
  cover: document.getElementById('cover'),
  birthday: document.getElementById('celebration'),
  letter: document.getElementById('letter-scene'),
};

const parcelStatus = document.getElementById('parcel-status');
const cake = document.getElementById('cake-scene');
const wishNote = document.getElementById('wish-note');
const blowButton = document.getElementById('blow-candles');
const letterButton = document.getElementById('open-letter');
const confetti = document.getElementById('confetti');
const colors = ['#ff8c95', '#ffd8ac', '#ffb9af', '#ffdddf', '#d7516b'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let confettiTimer;

function showScene(name, status) {
  for (const [key, scene] of Object.entries(scenes)) {
    const visible = key === name;
    scene.hidden = !visible;
    scene.classList.toggle('is-entering', visible);
  }

  parcelStatus.textContent = status;
  window.scrollTo(0, 0);
  scenes[name].querySelector('h1, h2').focus();
}

function celebrate(count) {
  if (reducedMotion.matches) return;

  const bits = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const bit = document.createElement('i');
    bit.style.setProperty('--left', `${Math.random() * 100}%`);
    bit.style.setProperty('--width', `${4 + Math.random() * 5}px`);
    bit.style.setProperty('--height', `${5 + Math.random() * 8}px`);
    bit.style.setProperty('--color', colors[i % colors.length]);
    bit.style.setProperty('--duration', `${1.4 + Math.random() * 1.6}s`);
    bit.style.setProperty('--delay', `${Math.random() * 0.5}s`);
    bit.style.setProperty('--drift', `${(Math.random() - 0.5) * 150}px`);
    bit.style.setProperty('--spin', `${(Math.random() - 0.5) * 850}deg`);
    bits.append(bit);
  }

  window.clearTimeout(confettiTimer);
  confetti.replaceChildren(bits);
  confettiTimer = window.setTimeout(() => confetti.replaceChildren(), 3600);
}

document.getElementById('open-gift').addEventListener('click', () => {
  showScene('birthday', '已拆封');
  celebrate(38);
});

blowButton.addEventListener('click', () => {
  cake.classList.add('is-out');
  wishNote.textContent = '愿望你收好。盒底还有一封信。';
  blowButton.hidden = true;
  letterButton.hidden = false;
  letterButton.focus();
  celebrate(62);
});

letterButton.addEventListener('click', () => showScene('letter', '信已送达'));

document.getElementById('replay').addEventListener('click', () => {
  window.clearTimeout(confettiTimer);
  confetti.replaceChildren();
  cake.classList.remove('is-out');
  wishNote.textContent = '先想一个愿望，别告诉我。';
  blowButton.hidden = false;
  letterButton.hidden = true;
  showScene('cover', '待拆封');
});
