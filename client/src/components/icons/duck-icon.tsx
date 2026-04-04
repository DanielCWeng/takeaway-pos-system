import type { AnimatedIconProps } from "./chicken-icon";

export function DuckIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        {/* Back Leg */}
        <g stroke="#332D27" fill="none">
          <path d="M 18 31 L 18 42 M 15 42 L 21 42" />
        </g>

        {/* Duck Rig */}
        <g id="duck-rig">
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-2; 0,0; 0,-2; 0,0"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              dur="1.2s"
              repeatCount="1"
            />
          )}

          <g id="torso-rotate">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 24 30; -5 24 30; 3 24 30; -2 24 30; 0 24 30"
                keyTimes="0; 0.15; 0.3; 0.45; 1"
                dur="1.2s"
                repeatCount="1"
              />
            )}

            {/* Lower Beak */}
            <g id="lower-beak">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 33 15; 25 33 15; 0 33 15; 20 33 15; 0 33 15"
                  keyTimes="0; 0.15; 0.3; 0.45; 1"
                  dur="1.2s"
                  repeatCount="1"
                />
              )}
              <path d="M 33 15 L 42 15 C 42 17 38 18 33 17 Z" fill="#F2A649" stroke="#332D27" />
            </g>

            {/* Upper Beak */}
            <path d="M 33 12 C 39 11 43 13 43 15 L 33 15 Z" fill="#F2A649" stroke="#332D27" />

            {/* Body */}
            <path
              id="duck-body"
              d="M 14 34 A 14 14 0 0 0 34 24 L 34 16 A 6 6 0 0 0 22 16 L 22 22 C 18 22 12 20 6 20 C 8 26 10 32 14 34 Z"
              fill="#FEF7ED"
              stroke="#332D27"
            />

            {/* Wing */}
            <g id="wing">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 18 24; -15 18 24; 5 18 24; -10 18 24; 0 18 24"
                  keyTimes="0; 0.15; 0.3; 0.45; 1"
                  dur="1.2s"
                  repeatCount="1"
                />
              )}
              <path d="M 16 26 Q 22 31 28 24" fill="none" stroke="#332D27" />
            </g>

            {/* Eye Blink */}
            <g id="eye-blink" transform="translate(28, 12)">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1 1; 1 1; 1 0.1; 1 1; 1 1"
                  keyTimes="0; 0.8; 0.85; 0.9; 1"
                  dur="1.2s"
                  repeatCount="1"
                />
              )}
              <circle cx="0" cy="0" r="1.5" fill="#332D27" stroke="none" />
            </g>
          </g>
        </g>

        {/* Front Leg */}
        <g stroke="#332D27" fill="none">
          <path d="M 28 32 L 28 42 M 25 42 L 31 42" />
        </g>
      </g>
    </svg>
  );
}
