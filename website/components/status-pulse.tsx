export function StatusPulse({ label = "System online" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="pulse-dot relative inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="label">{label}</span>
    </span>
  );
}
