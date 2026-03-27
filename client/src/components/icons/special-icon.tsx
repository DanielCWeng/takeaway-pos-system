import type { AnimatedIconProps } from "./chicken-icon";

export function SpecialIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <g id="special-icon" strokeLinecap="round" strokeLinejoin="round">
        {/* ROOT RIG */}
        <g id="special-rig" transform="translate(24, 24)">
          {/* SPARK LINES */}
          <g id="spark-lines" stroke="#FF9F00" strokeWidth="2">
            {/* Top Right */}
            <line x1="13" y1="-13" x2="17" y2="-17" opacity="0">
              {isAnimating && (
                <>
                  <animate
                    attributeName="opacity"
                    values="0; 0; 1; 0; 0"
                    keyTimes="0; 0.15; 0.2; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0; 0 0; 4 -4; 4 -4"
                    keyTimes="0; 0.15; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                    calcMode="spline"
                    keySplines="0 0 1 1; 0.2 0 0 1; 0 0 1 1"
                  />
                </>
              )}
            </line>

            {/* Bottom Right */}
            <line x1="13" y1="13" x2="17" y2="17" opacity="0">
              {isAnimating && (
                <>
                  <animate
                    attributeName="opacity"
                    values="0; 0; 1; 0; 0"
                    keyTimes="0; 0.15; 0.2; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0; 0 0; 4 4; 4 4"
                    keyTimes="0; 0.15; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                    calcMode="spline"
                    keySplines="0 0 1 1; 0.2 0 0 1; 0 0 1 1"
                  />
                </>
              )}
            </line>

            {/* Bottom Left */}
            <line x1="-13" y1="13" x2="-17" y2="17" opacity="0">
              {isAnimating && (
                <>
                  <animate
                    attributeName="opacity"
                    values="0; 0; 1; 0; 0"
                    keyTimes="0; 0.15; 0.2; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0; 0 0; -4 4; -4 4"
                    keyTimes="0; 0.15; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                    calcMode="spline"
                    keySplines="0 0 1 1; 0.2 0 0 1; 0 0 1 1"
                  />
                </>
              )}
            </line>

            {/* Top Left */}
            <line x1="-13" y1="-13" x2="-17" y2="-17" opacity="0">
              {isAnimating && (
                <>
                  <animate
                    attributeName="opacity"
                    values="0; 0; 1; 0; 0"
                    keyTimes="0; 0.15; 0.2; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0; 0 0; -4 -4; -4 -4"
                    keyTimes="0; 0.15; 0.35; 1"
                    dur="1.4s"
                    repeatCount="1"
                    calcMode="spline"
                    keySplines="0 0 1 1; 0.2 0 0 1; 0 0 1 1"
                  />
                </>
              )}
            </line>
          </g>

          {/* MAIN STAR RIG */}
          <g id="star-rig">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0; -8; 12; -3; 0; 0"
                keyTimes="0; 0.15; 0.3; 0.45; 0.6; 1"
                dur="1.4s"
                repeatCount="1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
              />
            )}

            <g id="star-scale">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1 1; 1.05 0.95; 0.9 1.1; 1.02 0.98; 1 1; 1 1"
                  keyTimes="0; 0.15; 0.3; 0.45; 0.6; 1"
                  dur="1.4s"
                  repeatCount="1"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1"
                />
              )}

              <path
                d="M 0 -18 
                   L 5.2 -7.5 
                   L 16.8 -5.8 
                   L 8.4 2.4 
                   L 10.4 14 
                   L 0 8.5 
                   L -10.4 14 
                   L -8.4 2.4 
                   L -16.8 -5.8 
                   L -5.2 -7.5 
                   Z"
                fill="#FFF5D1"
                stroke="#FF9F00"
                strokeWidth="2"
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
