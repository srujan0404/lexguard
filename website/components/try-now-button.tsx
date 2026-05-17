import Link from "next/link";

export function TryNowButton({
  href = "/scan",
  label = "Try LexGuard now",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link href={href} className="try-now group">
      <span className="try-now-border" aria-hidden />
      <span className="try-now-inner">
        <span className="display-italic text-2xl md:text-3xl text-ink">
          {label}
        </span>
        <span
          aria-hidden
          className="text-2xl text-accent transition-transform duration-300 group-hover:translate-x-1"
        >
          ↗
        </span>
      </span>
    </Link>
  );
}
