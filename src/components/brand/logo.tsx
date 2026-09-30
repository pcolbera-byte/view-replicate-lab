// Marca do Vigentt: escudo (seguro) com a seta de renovação e o "ok" da apólice renovada.
// A mesma arte está em branding/marca.svg (ícones do app e das lojas).
import { useId } from "react";
import { cn } from "@/lib/utils";

export function BrandMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string | undefined;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Vigentt"
    >
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1bb3f0" />
          <stop offset="0.55" stopColor="#0a86d0" />
          <stop offset="1" stopColor="#0c3f86" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-f)`} />
      <path
        d="M32 8.5 50.5 15v14.8c0 12.2-7.6 20.9-18.5 25.7C21.1 50.7 13.5 42 13.5 29.8V15Z"
        fill="#fff"
      />
      <path
        d="M41.5 31a9.5 9.5 0 1 1-4.75-8.23"
        fill="none"
        stroke="#0a86d0"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path d="M40.9 25.2 35 25.9l3.9-6.3Z" fill="#0a86d0" />
      <path
        d="m27.8 31.4 3.1 3.1 5.4-6.2"
        fill="none"
        stroke="#0c3f86"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Nome "vigentt" com o "tt" em celeste (claro sobre fundo escuro). */
export function Wordmark({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string | undefined;
}) {
  return (
    <span className={cn("font-display font-bold tracking-tight", className)}>
      vigen
      <span className={onDark ? "text-celeste-bright" : "text-celeste"}>tt</span>
    </span>
  );
}
