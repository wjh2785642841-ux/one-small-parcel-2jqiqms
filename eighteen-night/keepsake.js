async function saveKeepsake(letter, filename = '给彬哥的信.png') {
  const { recipient, title, paragraphs, signature } = letter ?? {};
  if (![recipient, title, signature, filename].every(value => typeof value === 'string') ||
      !Array.isArray(paragraphs) || !paragraphs.every(value => typeof value === 'string')) {
    throw new TypeError('来信的文字格式有误。');
  }

  const canvas = document.createElement('canvas');
  let context = canvas.getContext('2d');
  if (!context) throw new Error('这个浏览器暂时无法生成信纸图片。');

  const pageWidth = 680;
  const inset = 76;
  const lineWidth = pageWidth - inset * 2;
  const sans = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  const serif = '"Songti SC", SimSun, "Noto Serif CJK SC", serif';
  const types = {
    recipient: { font: `500 24px ${sans}`, height: 36, color: '#806344' },
    title: { font: `700 44px ${serif}`, height: 60, color: '#2f2119' },
    body: { font: `400 25px ${serif}`, height: 46, color: '#39302a' },
    signature: { font: `600 25px ${serif}`, height: 39, color: '#594435' },
  };
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
    : null;
  const openPunctuation = '（《“‘「『【〔〈〖［｛([{';
  const closePunctuation = '、。，．：；？！）》”’」』】〕〉〗］｝…％%‰℃・,.!?;:)]}';
  const latinOrDigit = /^[\p{Script_Extensions=Latin}\p{Number}]\p{Mark}*$/u;
  const wordJoiner = /^[._'’+@/-]$/;
  const isSpace = character => /^\s+$/u.test(character);

  function wrap(text, face) {
    context.font = face.font;
    return text.split(/\r\n|\r|\n/).flatMap(logicalLine => {
      const trimmed = logicalLine.trim();
      if (!trimmed) return [''];
      const characters = segmenter
        ? Array.from(segmenter.segment(trimmed), part => part.segment)
        : Array.from(trimmed);
      const isWord = character => typeof character === 'string' && latinOrDigit.test(character);

      function breakAllowed(index, keepWord) {
        let previous = index - 1;
        let next = index;
        while (previous >= 0 && isSpace(characters[previous])) previous -= 1;
        while (next < characters.length && isSpace(characters[next])) next += 1;
        if (next === characters.length) return true;

        const before = characters[previous];
        const after = characters[next];
        if ((before && openPunctuation.includes(before)) || closePunctuation.includes(after)) return false;
        if (before === '—' && after === '—') return false;
        if (!keepWord || next !== index || previous !== index - 1) return true;

        if (isWord(before) && isWord(after)) return false;
        if (isWord(before) && wordJoiner.test(after) && isWord(characters[next + 1])) return false;
        return !(wordJoiner.test(before) && isWord(characters[previous - 1]) && isWord(after));
      }

      const rows = [];
      for (let start = 0; start < characters.length;) {
        let fit = start + 1;
        let row = characters[start];
        while (fit < characters.length) {
          const candidate = row + characters[fit];
          if (context.measureText(candidate.trimEnd()).width > lineWidth) break;
          row = candidate;
          fit += 1;
        }

        let cut = fit;
        while (cut > start && !breakAllowed(cut, true)) cut -= 1;
        if (cut === start) {
          cut = fit;
          while (cut > start && !breakAllowed(cut, false)) cut -= 1;
          if (cut === start) cut = fit;
        }
        rows.push(characters.slice(start, cut).join('').trimEnd());
        start = cut;
        while (start < characters.length && isSpace(characters[start])) start += 1;
      }
      return rows;
    });
  }

  let y = 76;
  const blocks = [];
  function block(text, face, gap = 0, align = 'left') {
    const lines = wrap(text, face);
    blocks.push({ lines, face, y, align });
    y += lines.length * face.height + gap;
  }
  block(recipient, types.recipient, 10);
  block(title, types.title, 38);
  const ruleY = y - 23;
  for (const paragraph of paragraphs) block(paragraph, types.body, 16);
  y += 15;
  block(signature, types.signature, 0, 'right');

  const pageHeight = y + 74;
  const scale = Math.min(2, 4096 / Math.max(pageWidth, pageHeight));
  canvas.width = Math.round(pageWidth * scale);
  canvas.height = Math.round(pageHeight * scale);
  context = canvas.getContext('2d');
  context.scale(canvas.width / pageWidth, canvas.height / pageHeight);

  const paper = context.createLinearGradient(0, 0, pageWidth, pageHeight);
  paper.addColorStop(0, '#fff9ed');
  paper.addColorStop(1, '#f1e3ca');
  context.fillStyle = paper;
  context.fillRect(0, 0, pageWidth, pageHeight);
  context.strokeStyle = '#b79e75';
  context.lineWidth = 1;
  context.strokeRect(30, 30, pageWidth - 60, pageHeight - 60);
  context.fillStyle = '#9e7243';
  context.fillRect(inset, ruleY, 46, 2);

  context.textBaseline = 'top';
  for (const section of blocks) {
    context.font = section.face.font;
    context.fillStyle = section.face.color;
    context.textAlign = section.align;
    const x = section.align === 'right' ? pageWidth - inset : inset;
    section.lines.forEach((line, index) => {
      context.fillText(line, x, section.y + index * section.face.height, lineWidth);
    });
  }

  const download = document.createElement('a');
  if (!('download' in download)) throw new Error('这个浏览器暂时不支持下载信纸。');
  const png = canvas.toDataURL('image/png');
  if (!png.startsWith('data:image/png;base64,')) throw new Error('信纸图片生成失败。');
  download.href = png;
  download.download = filename;
  download.hidden = true;
  document.body.append(download);
  try {
    // Keep the download in the same user gesture on mobile browsers.
    download.click();
  } finally {
    download.remove();
  }
  return true;
}
