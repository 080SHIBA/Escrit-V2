import { parseInline, parseMarkdown } from '../../lib/lessonMarkdown.js';

// WHAT: renders lesson text with comfortable, scannable typography.
// WHY: the polish step turns raw text into headings, lists and short paragraphs; this gives them a
// readable line length, generous spacing and clear hierarchy, which matters most for long-form learning.
function Inline({ parts }) {
  return parts.map((part, index) => {
    if (part.type === 'bold') return <strong key={index}>{part.text}</strong>;
    if (part.type === 'italic') return <em key={index}>{part.text}</em>;
    if (part.type === 'link') return <a key={index} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-2">{part.text}</a>;
    return <span key={index}>{part.text}</span>;
  });
}

export default function LessonText({ markdown }) {
  const blocks = parseMarkdown(markdown);
  if (!blocks.length) return null;
  return (
    <div className="max-w-[68ch] space-y-4 text-[17px] leading-8 text-ink/90">
      {blocks.map((block, index) => {
        if (block.type === 'h') return block.level === 2
          ? <h2 key={index} className="mt-8 font-display text-2xl leading-tight text-ink"><Inline parts={block.inline} /></h2>
          : <h3 key={index} className="mt-6 font-display text-xl text-ink"><Inline parts={block.inline} /></h3>;
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return <Tag key={index} className={`space-y-2 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-accent`}>{block.items.map((item, i) => <li key={i}><Inline parts={item} /></li>)}</Tag>;
        }
        return <p key={index}><Inline parts={block.inline} /></p>;
      })}
    </div>
  );
}

export { parseInline };
