import type { AnimatedIconProps } from "./chicken-icon";

export function VegIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* ROOT RIG */}
        <g transform="translate(0,0)">
          {/* TRANSLATE */}
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 1; 0 -3.5; 0 0.5; 0 0; 0 0"
              keyTimes="0; 0.15; 0.35; 0.55; 0.75; 1"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
              calcMode="spline"
              dur="1.4s"
              repeatCount="1"
            />
          )}

          {/* SQUASH / STRETCH */}
          <g transform="translate(0,0)">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; 1.06 0.94; 0.92 1.08; 1.03 0.97; 1 1; 1 1"
                keyTimes="0; 0.15; 0.35; 0.55; 0.75; 1"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
                calcMode="spline"
                dur="1.4s"
                repeatCount="1"
              />
            )}

            {/* LEAF GROUP */}
            <g>
              {/* CENTER LEAF */}
              <g>
                {isAnimating && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 24 22; -5 24 22; 8 24 22; -3 24 22; 0 24 22; 0 24 22"
                    keyTimes="0; 0.18; 0.40; 0.60; 0.85; 1"
                    keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
                    calcMode="spline"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
                <path
                  d="M 24 22 C 21 12 24 8 24 8 C 27 12 26 18 24 22 Z"
                  fill="#20BF6B"
                  stroke="#2C3E50"
                  strokeWidth="2"
                />
              </g>

              {/* LEFT LEAF */}
              <g>
                {isAnimating && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 20 23; -12 20 23; 18 20 23; -6 20 23; 0 20 23; 0 20 23"
                    keyTimes="0; 0.18; 0.40; 0.60; 0.85; 1"
                    keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
                    calcMode="spline"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
                <path
                  d="M 20 23 C 14 18 11 13 11 13 C 15 12 19 18 20 23 Z"
                  fill="#20BF6B"
                  stroke="#2C3E50"
                  strokeWidth="2"
                />
              </g>

              {/* RIGHT LEAF */}
              <g>
                {isAnimating && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 28 23; 12 28 23; -18 28 23; 6 28 23; 0 28 23; 0 28 23"
                    keyTimes="0; 0.18; 0.40; 0.60; 0.85; 1"
                    keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
                    calcMode="spline"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
                <path
                  d="M 28 23 C 34 18 37 13 37 13 C 33 12 29 18 28 23 Z"
                  fill="#20BF6B"
                  stroke="#2C3E50"
                  strokeWidth="2"
                />
              </g>
            </g>

            {/* BODY */}
            <g>
              <path
                d="M 16 24 Q 24 22 32 24 Q 30 38 24 42 Q 18 38 16 24 Z"
                fill="#FF9F43"
                stroke="#2C3E50"
                strokeWidth="2"
              />

              <path d="M 18 29 L 23 29" stroke="#2C3E50" strokeWidth="2" />
              <path d="M 25 34 L 29 34" stroke="#2C3E50" strokeWidth="2" />
              <path d="M 21 38 L 24 38" stroke="#2C3E50" strokeWidth="2" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
