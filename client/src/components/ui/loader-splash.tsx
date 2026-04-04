import { cn } from "../../lib/utils";

interface LoaderSplashProps {
  title?: string;
  subtitle?: string;
  svgMarkup?: string; // optional custom SVG markup string (e.g., from Gemini)
  className?: string;
}

// Prompt to generate a bespoke loader SVG (feed into Gemini 3.1 Pro or similar):
// "Generate an SVG illustration of a looping, friendly line-art wok with swirling steam, sized 320x180, dark-mode friendly, no text, flat colors only, keep total size under 40KB, and animate steam with SMIL or CSS."

const fallbackSvg = `
<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cooking in progress">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="steam" x1="0" x2="0" y1="1" y2="0">
      <stop offset="0%" stop-color="#9CA3AF" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#E5E7EB" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" rx="16" fill="url(#bg)"/>
  <g transform="translate(60 40)" stroke="#E5E7EB" stroke-width="3" stroke-linecap="round" fill="none">
    <path d="M10 95 Q80 125 190 95" stroke="#374151" stroke-width="12" stroke-linecap="round"/>
    <path d="M0 92 Q95 140 205 92" stroke="#111827" stroke-width="16" stroke-linecap="round"/>
    <path d="M22 96 Q105 120 178 96" stroke="#4B5563" stroke-width="8" stroke-linecap="round"/>
    <path d="M40 50 Q70 10 60 0" stroke="url(#steam)">
      <animate attributeName="d" dur="3.5s" repeatCount="indefinite"
        values="
          M40 50 Q70 10 60 0;
          M42 48 Q78 4 66 -6;
          M38 52 Q68 14 58 4;
          M40 50 Q70 10 60 0" />
    </path>
    <path d="M90 46 Q120 12 110 0" stroke="url(#steam)">
      <animate attributeName="d" dur="3.2s" repeatCount="indefinite" begin="0.3s"
        values="
          M90 46 Q120 12 110 0;
          M94 44 Q132 6 116 -6;
          M88 48 Q118 14 106 4;
          M90 46 Q120 12 110 0" />
    </path>
    <path d="M140 52 Q170 18 160 6" stroke="url(#steam)">
      <animate attributeName="d" dur="3.8s" repeatCount="indefinite" begin="0.6s"
        values="
          M140 52 Q170 18 160 6;
          M146 50 Q182 10 168 -4;
          M136 54 Q166 22 154 10;
          M140 52 Q170 18 160 6" />
    </path>
  </g>
</svg>
`;

export function LoaderSplash({
  title = "Loading…",
  subtitle,
  svgMarkup,
  className,
}: LoaderSplashProps) {
  return (
    <div
      className={cn(
        "pos-panel flex h-full min-h-[320px] w-full flex-col items-center justify-center p-6 text-center",
        className,
      )}
    >
      <div className="w-full max-w-[640px] mx-auto rounded-[18px] bg-gradient-to-b from-white/6 to-white/0 p-4 shadow-soft">
        <div
          className="w-full rounded-[12px] overflow-hidden"
          style={{ aspectRatio: "16 / 9" }}
          dangerouslySetInnerHTML={{ __html: svgMarkup || fallbackSvg }}
        />
        <div className="mt-3 flex flex-col gap-1">
          <p className="font-semibold text-foreground">{title}</p>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
