import type { AnimatedIconProps } from "./chicken-icon";

export function PorkIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <defs></defs>

      <g
        stroke="#422B29"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      >
        <path d="M 38 28 C 43 25, 46 31, 42 33 C 40 34, 39 31, 41 29">
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 38 28; -10 38 28; 5 38 28; -10 38 28; 0 38 28; 0 38 28"
              keyTimes="0; 0.15; 0.25; 0.35; 0.45; 1"
              calcMode="spline"
              keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0 0 1 1"
              dur="1.4s"
              repeatCount="1"
            />
          )}
        </path>
      </g>

      <path
        d="M 17 38 L 17 40 A 2 2 0 0 0 21 40 L 21 38"
        fill="#FFB3C6"
        stroke="#422B29"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M 27 38 L 27 40 A 2 2 0 0 0 31 40 L 31 38"
        fill="#FFB3C6"
        stroke="#422B29"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <rect
        x="10"
        y="14"
        width="28"
        height="26"
        rx="12"
        fill="#FFD3DC"
        stroke="#422B29"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <path
        d="M 13 18 L 8 11 C 10 8, 15 9, 20 14 Z"
        fill="#FFB3C6"
        stroke="#422B29"
        stroke-width="2"
        stroke-linejoin="round"
      >
        {isAnimating && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 16 16; -12 16 16; 4 16 16; -12 16 16; 0 16 16; 0 16 16"
            keyTimes="0; 0.13; 0.23; 0.33; 0.43; 1"
            calcMode="spline"
            keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0 0 1 1"
            dur="1.4s"
            repeatCount="1"
          />
        )}
      </path>

      <path
        d="M 35 18 L 40 11 C 38 8, 33 9, 28 14 Z"
        fill="#FFB3C6"
        stroke="#422B29"
        stroke-width="2"
        stroke-linejoin="round"
      >
        {isAnimating && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 32 16; 12 32 16; -4 32 16; 12 32 16; 0 32 16; 0 32 16"
            keyTimes="0; 0.13; 0.23; 0.33; 0.43; 1"
            calcMode="spline"
            keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0 0 1 1"
            dur="1.4s"
            repeatCount="1"
          />
        )}
      </path>

      <g>
        {isAnimating && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-1.5; 0,0.5; 0,-1.5; 0,0; 0,0"
            keyTimes="0; 0.1; 0.2; 0.3; 0.4; 1"
            calcMode="spline"
            keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0 0 1 1"
            dur="1.4s"
            repeatCount="1"
          />
        )}

        <ellipse cx="17" cy="23" rx="1.5" ry="1.5" fill="#422B29">
          {isAnimating && (
            <animate
              attributeName="ry"
              values="1.5; 1.5; 0.1; 1.5; 1.5"
              keyTimes="0; 0.65; 0.7; 0.75; 1"
              dur="1.4s"
              repeatCount="1"
            />
          )}
        </ellipse>
        <ellipse cx="31" cy="23" rx="1.5" ry="1.5" fill="#422B29">
          {isAnimating && (
            <animate
              attributeName="ry"
              values="1.5; 1.5; 0.1; 1.5; 1.5"
              keyTimes="0; 0.65; 0.7; 0.75; 1"
              dur="1.4s"
              repeatCount="1"
            />
          )}
        </ellipse>

        <g>
          <ellipse cx="24" cy="28.5" rx="7" ry="5" fill="#FFB3C6" stroke="#422B29" stroke-width="2">
            {isAnimating && (
              <animate
                attributeName="ry"
                values="5; 4.5; 5.5; 4.5; 5; 5"
                keyTimes="0; 0.1; 0.2; 0.3; 0.4; 1"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0 0 1 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}
          </ellipse>

          <line
            x1="21.5"
            y1="27.5"
            x2="21.5"
            y2="29.5"
            stroke="#422B29"
            stroke-width="2"
            stroke-linecap="round"
          />
          <line
            x1="26.5"
            y1="27.5"
            x2="26.5"
            y2="29.5"
            stroke="#422B29"
            stroke-width="2"
            stroke-linecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
