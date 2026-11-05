// WHAT: a tiny, safe Markdown reader for lesson text (pure: text in, blocks out).
// WHY our own instead of a library plus innerHTML: lesson text is written by sellers and shown to
// learners, so it must never be able to inject HTML or scripts. This produces plain data (blocks and
// inline pieces) that React renders as ordinary elements, and only https links are ever linked.
// Supported: ## / ### headings, paragraphs, - bullet and 1. numbered lists, **bold**, *italic*, [text](https://...).
export function parseInline(text) {
  const out = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\))/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[2]) out.push({ type: 'bold', text: match[2] });
    else if (match[3]) out.push({ type: 'italic', text: match[3] });
    else out.push({ type: 'link', text: match[4], href: match[5] });
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(markdown = '') {
  const blocks = [];
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  let list = null;
  let paragraph = [];
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ type: 'p', inline: parseInline(paragraph.join(' ')) }); paragraph = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = /^(#{2,4})\s+(.*)$/.exec(line) || /^#\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading.length === 3 ? heading[1].length : 2;
      blocks.push({ type: 'h', level: Math.min(level, 3), inline: parseInline(heading[heading.length - 1]) });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d{1,2}\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) { flushList(); list = { type: 'list', ordered, items: [] }; }
      list.items.push(parseInline((bullet || numbered)[1]));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return blocks;
}

// Rough reading time for the lesson header (200 words a minute, minimum 1).
export function readingMinutes(markdown = '') {
  return Math.max(1, Math.round(String(markdown).split(/\s+/).filter(Boolean).length / 200));
}
