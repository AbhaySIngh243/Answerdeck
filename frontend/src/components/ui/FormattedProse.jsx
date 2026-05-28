import { parseProseBlocks, sanitizeProse } from '../../lib/sanitizeProse';
import { cn } from '../../lib/utils';

export function ProseText({ text, className, as: Tag = 'p' }) {
  const clean = sanitizeProse(text);
  if (!clean) return null;
  return <Tag className={className}>{clean}</Tag>;
}

export default function FormattedProse({ text, className }) {
  const blocks = parseProseBlocks(text);
  if (!blocks.length) return null;

  const textClass = cn('leading-relaxed text-slate-600', className || 'text-[13px]');

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p key={`p-${index}`} className={textClass}>
              {block.text}
            </p>
          );
        }

        if (block.type === 'ordered') {
          return (
            <ol key={`ol-${index}`} className={cn('list-decimal space-y-1.5 pl-5', textClass)}>
              {block.items.map((item, itemIndex) => (
                <li key={`oli-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ol>
          );
        }

        return (
          <ul key={`ul-${index}`} className={cn('list-disc space-y-1.5 pl-5', textClass)}>
            {block.items.map((item, itemIndex) => (
              <li key={`uli-${index}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
