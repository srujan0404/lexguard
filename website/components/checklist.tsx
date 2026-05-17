export function Checklist({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="border-t border-rule pt-12">
      <div className="flex items-baseline gap-3 mb-8">
        <span className="label">pre-sign checklist</span>
        <span className="h-px flex-1 bg-rule" />
        <span className="label">ask before you agree</span>
      </div>
      <ol className="grid gap-7 max-w-3xl">
        {items.map((q, i) => (
          <li
            key={i}
            className="grid grid-cols-[3rem_1fr] items-baseline gap-4"
          >
            <span className="display-italic text-3xl text-ink-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-ink text-lg leading-relaxed">{q}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
