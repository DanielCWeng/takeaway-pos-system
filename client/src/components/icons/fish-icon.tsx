import type { AnimatedIconProps } from "./chicken-icon";

export function FishIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <g id="prawn-icon" strokeLinecap="round" strokeLinejoin="round">
        {/* ROOT RIG */}
        <g id="prawn-rig" transform="translate(0,0)">
          {/* TRANSLATE + ROTATE (combined like chicken style) */}
          {isAnimating && (
            <>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 2 0; -4 0; -5 0; 0 0"
                keyTimes="0; 0.15; 0.3; 0.45; 1"
                calcMode="spline"
                keySplines="0.4 0 0.8 1; 0 0 0.2 1; 0.25 0.1 0.25 1; 0.4 0 0.2 1"
                dur="1.4s"
                repeatCount="1"
              />
              <animateTransform
                attributeName="transform"
                additive="sum"
                type="rotate"
                values="0 24 24; -4 24 24; 6 24 24; 2 24 24; 0 24 24"
                keyTimes="0; 0.15; 0.3; 0.45; 1"
                calcMode="spline"
                keySplines="0.4 0 0.8 1; 0 0 0.2 1; 0.25 0.1 0.25 1; 0.4 0 0.2 1"
                dur="1.4s"
                repeatCount="1"
              />
            </>
          )}

          {/* SQUASH / STRETCH */}
          <g id="body-scale" transform="translate(0,0)">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; 0.92 1.08; 1.08 0.92; 0.98 1.02; 1 1"
                keyTimes="0; 0.15; 0.3; 0.45; 1"
                calcMode="spline"
                keySplines="0.4 0 0.8 1; 0 0 0.2 1; 0.25 0.1 0.25 1; 0.4 0 0.2 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}

            {/* DORSAL FIN */}
            <path
              id="dorsal-fin"
              d="M 18 17 L 22 9 C 25 9, 29 12, 30 19 Z"
              fill="#63B3ED"
              stroke="#1E3A8A"
              strokeWidth="2"
            />

            {/* TAIL */}
            <g id="tail-fin">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 30 24; 25 30 24; -30 30 24; 15 30 24; -5 30 24; 0 30 24; 0 30 24"
                  keyTimes="0; 0.15; 0.25; 0.35; 0.45; 0.7; 1"
                  calcMode="spline"
                  keySplines="0.4 0 0.8 1; 0 0 0.2 1; 0.25 0.1 0.25 1; 0.25 0.1 0.25 1; 0.25 0.1 0.25 1; 0.4 0 1 1"
                  dur="1.4s"
                  repeatCount="1"
                />
              )}
              <path
                d="M 30 24 L 40 16 C 42 19, 42 29, 40 32 Z"
                fill="#63B3ED"
                stroke="#1E3A8A"
                strokeWidth="2"
              />
            </g>

            {/* BODY */}
            <path
              id="body"
              d="M 8 25 C 8 14, 24 14, 33 22 L 33 26 C 24 34, 8 34, 8 25 Z"
              fill="#BEE3F8"
              stroke="#1E3A8A"
              strokeWidth="2"
            />

            {/* PECTORAL FIN */}
            <g id="pectoral-fin">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 21 26; -15 21 26; 35 21 26; 0 21 26; 0 21 26"
                  keyTimes="0; 0.15; 0.3; 0.6; 1"
                  calcMode="spline"
                  keySplines="0.4 0 0.8 1; 0 0 0.2 1; 0.25 0.1 0.25 1; 0.4 0 1 1"
                  dur="1.4s"
                  repeatCount="1"
                />
              )}
              <path
                d="M 21 26 C 24 24, 27 25, 28 29 C 25 30, 22 29, 21 26 Z"
                fill="#63B3ED"
                stroke="#1E3A8A"
                strokeWidth="2"
              />
            </g>

            {/* EYE */}
            <g id="eye-position">
              <g id="eye-scale">
                <circle cx="15" cy="20" r="2.5" fill="#1E3A8A" />
                <circle cx="14" cy="19" r="0.75" fill="#FFFFFF" />
                {isAnimating && (
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="1 1; 1 1; 1 0.1; 1 1; 1 1"
                    keyTimes="0; 0.65; 0.7; 0.75; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
