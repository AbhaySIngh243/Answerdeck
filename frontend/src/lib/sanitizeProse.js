function stripInlineMarkdown(line) {
  let text = String(line || '');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  for (let i = 0; i < 4; i += 1) {
    const next = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
    if (next === text) break;
    text = next;
  }
  return text.replace(/\*\*/g, '').replace(/__/g, '').trim();
}

export function sanitizeProse(value) {
  const text = String(value || '');
  if (!text.trim()) return '';

  let body = text.replace(/```(?:[a-zA-Z0-9_-]+)?\s*/g, '').replace(/```/g, '');
  const cleanedLines = [];

  for (const rawLine of body.split('\n')) {
    let line = rawLine.replace(/\s+$/, '');
    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      cleanedLines.push('');
      continue;
    }
    line = line
      .replace(/^\s{0,3}#{1,6}\s*/, '')
      .replace(/(?<!\S)#{2,6}\s+/g, '')
      .replace(/^\s{0,3}>\s?/, '')
      .replace(/^\s{0,3}[-*+]\s+/, '');
    cleanedLines.push(stripInlineMarkdown(line));
  }

  body = cleanedLines.join('\n');
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

export function parseProseBlocks(value) {
  const text = sanitizeProse(value);
  if (!text) return [];

  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };

  const flushList = () => {
    if (!list?.items?.length) {
      list = null;
      return;
    }
    blocks.push(list);
    list = null;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);
    const unordered = line.match(/^[-*•]\s+(.+)$/);

    if (ordered) {
      flushParagraph();
      if (!list || list.type !== 'ordered') {
        flushList();
        list = { type: 'ordered', items: [] };
      }
      list.items.push(ordered[2]);
      continue;
    }

    if (unordered) {
      flushParagraph();
      if (!list || list.type !== 'unordered') {
        flushList();
        list = { type: 'unordered', items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
