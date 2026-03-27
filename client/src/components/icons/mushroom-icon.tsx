import type { AnimatedIconProps } from "./chicken-icon";

export function MushroomIcon({ isAnimating, ...props }: AnimatedIconProps) {
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
        <g id="mushroom-rig" transform="translate(0,0)">
          {/* SCALE (squash & stretch like fish body-scale) */}
          <g id="body-scale">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; 1.06 0.92; 0.96 1.06; 1.02 0.98; 1 1"
                keyTimes="0; 0.2; 0.5; 0.75; 1"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}

            {/* STEM */}
            <path
              d="M 20 26 V 36 C 20 38.5 28 38.5 28 36 V 26 Z"
              fill="#F4EAE0"
              stroke="#4A3B32"
              strokeWidth="2"
            />

            {/* CAP TRANSLATE */}
            <g id="cap-translate">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0; 0 1.5; 0 -2.5; 0 0.5; 0 0"
                  keyTimes="0; 0.2; 0.5; 0.75; 1"
                  calcMode="spline"
                  keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
                  dur="1.4s"
                  repeatCount="1"
                />
              )}

              {/* CAP ROTATE */}
              <g id="cap-rotate">
                {isAnimating && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 24 24; 6 24 24; -4 24 24; 2 24 24; 0 24 24"
                    keyTimes="0; 0.25; 0.55; 0.8; 1"
                    calcMode="spline"
                    keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}

                {/* CAP */}
                <path
                  d="M 8 26 C 8 4, 40 4, 40 26 C 40 30, 8 30, 8 26 Z"
                  fill="#D16D54"
                  stroke="#4A3B32"
                  strokeWidth="2"
                />

                {/* SPOTS */}
                <circle cx="16" cy="23" r="3.5" fill="#F4EAE0" />
                <circle cx="32" cy="23" r="2.5" fill="#F4EAE0" />
                <circle cx="25" cy="17" r="4.5" fill="#F4EAE0" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
