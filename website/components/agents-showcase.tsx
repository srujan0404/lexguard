const AGENTS = [
  {
    n: "01",
    name: "Extractor",
    role: "segments the document",
    body: "Pulls the raw text apart into discrete clauses, tags each with a type and the parties affected. Also identifies the issuer for the recycled-template detector.",
  },
  {
    n: "02",
    name: "Risk",
    role: "scores each clause",
    body: "Classifies severity (low → critical) and assigns up to 19 stable risk categories. One Gemini call covers all clauses in a single batched pass.",
  },
  {
    n: "03",
    name: "Rights",
    role: "grounds in Indian law",
    body: "RAG against a curated 24-statute civil-law KB. Cites the Indian Contract Act, DPDP 2023, IT Act §43A — never IPC. Hallucinated citations are physically impossible: the model only sees what we retrieved.",
  },
  {
    n: "04",
    name: "Red-Team",
    role: "argues from the issuer's side",
    body: "Plays the drafter. Surfaces the realistic exploitation path so users see who actually benefits from each clause and how it might be used against them.",
  },
  {
    n: "05",
    name: "Judge",
    role: "synthesizes the verdict",
    body: "Reads the upstream three for each clause, decides final severity, writes the plain-language explanation, suggests a safer rewrite, and seeds the follow-up chat with three document-specific questions.",
  },
];

export function AgentsShowcase() {
  return (
    <section className="border-t border-rule pt-14">
      <div className="flex items-baseline gap-3 mb-10">
        <span className="label">how it works</span>
        <span className="h-px flex-1 bg-rule" />
        <span className="label">five agents · one orchestrator</span>
      </div>

      <p className="display max-w-3xl text-[clamp(1.6rem,3.5vw,2.6rem)] text-ink mb-12 leading-[1.05]">
        Not one model answering one prompt. <span className="display-italic text-ink-mid">Five</span>{" "}
        specialists, each with a closed scope, running in parallel and then synthesised.
      </p>

      <ol className="grid gap-px bg-rule md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a) => (
          <li
            key={a.n}
            className="bg-bg p-6 border border-transparent tilt-on-hover hover:bg-surface/40"
          >
            <div className="flex items-baseline gap-3 mb-3">
              <span className="display-italic text-2xl text-ink-faint">{a.n}</span>
              <span className="label">{a.role}</span>
            </div>
            <h3 className="display text-2xl text-ink mb-3">{a.name}</h3>
            <p className="text-ink-mid text-sm leading-relaxed">{a.body}</p>
          </li>
        ))}
        <li className="bg-bg p-6 border border-transparent flex flex-col justify-between">
          <div>
            <span className="label">retrieval</span>
            <h3 className="display text-2xl text-ink my-3">RAG</h3>
            <p className="text-ink-mid text-sm leading-relaxed">
              Before Rights runs, a keyword retriever scores every clause against the 24-statute KB and
              injects the top 5 into the prompt context. Deterministic, sub-millisecond, fully auditable.
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}
