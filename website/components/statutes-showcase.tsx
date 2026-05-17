"use client";

const FEATURED = [
  {
    id: "ica_s27",
    act: "Indian Contract Act, 1872",
    section: "27",
    title: "Agreements in restraint of trade are void",
    blurb: "Why most Indian non-competes are unenforceable.",
  },
  {
    id: "dpdp_s4",
    act: "Digital Personal Data Protection Act, 2023",
    section: "4",
    title: "Grounds for processing personal data",
    blurb: "Consent or narrow legitimate uses only — no GDPR-style \"legitimate interest\" wildcard.",
  },
  {
    id: "ieso_1946",
    act: "Industrial Employment (Standing Orders) Act, 1946",
    section: "Schedule",
    title: "Probation, leave, termination protections",
    blurb: "What a six-month, indefinitely-extendable probation actually violates.",
  },
];

export function StatutesShowcase({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <section className="border-t border-rule pt-14">
      <div className="flex items-baseline gap-3 mb-10">
        <span className="label">grounded in</span>
        <span className="h-px flex-1 bg-rule" />
        <span className="label">24 civil-law statutes · never IPC</span>
      </div>

      <p className="display max-w-3xl text-[clamp(1.4rem,3vw,2.2rem)] text-ink mb-10 leading-[1.1]">
        Every flag is tied to <span className="display-italic">actual law</span>. Click a statute to read
        its plain-English summary.
      </p>

      <ul className="grid gap-4 md:grid-cols-3 items-stretch">
        {FEATURED.map((s) => (
          <li key={s.id} className="h-full">
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="w-full h-full text-left p-6 border border-rule rounded-sm tilt-on-hover hover:border-accent flex flex-col"
            >
              <p className="label mb-2">
                {s.act} · §{s.section}
              </p>
              <h3 className="display text-xl text-ink mb-3 leading-snug">
                {s.title}
              </h3>
              <p className="text-ink-mid text-sm leading-relaxed">
                {s.blurb}
              </p>
              <span className="label-wide text-accent mt-auto pt-6">
                read summary ↗
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
