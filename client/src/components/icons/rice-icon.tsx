import type { AnimatedIconProps } from "./chicken-icon";

export function RiceIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <g
        id="rice-icon"
        stroke="#3B3131"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* STEAM */}
        <g id="steam">
          <g>
            <path d="M 18 14 C 15 11, 21 8, 18 4" opacity="0">
              {isAnimating && (
                <>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,2; 0,-6"
                    dur="1.4s"
                    repeatCount="1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0; 0.6; 0"
                    keyTimes="0; 0.5; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                </>
              )}
            </path>
          </g>

          <g>
            <path d="M 30 12 C 33 9, 27 6, 30 2" opacity="0">
              {isAnimating && (
                <>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,2; 0,-6"
                    dur="1.4s"
                    begin="-0.7s"
                    repeatCount="1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0; 0.6; 0"
                    keyTimes="0; 0.5; 1"
                    dur="1.4s"
                    begin="-0.7s"
                    repeatCount="1"
                  />
                </>
              )}
            </path>
          </g>
        </g>

        {/* RICE */}
        <g id="rice-body">
          <path
            d="M 8 28 C 8 18, 16 14, 24 14 C 32 14, 40 18, 40 28 Z"
            fill="#FDFBF7"
          >
            {isAnimating && (
              <animate
                attributeName="d"
                values="
                  M 8 28 C 8 18, 16 14, 24 14 C 32 14, 40 18, 40 28 Z; 
                  M 8 28 C 8 16.5, 16 11.5, 24 11.5 C 32 11.5, 40 16.5, 40 28 Z; 
                  M 8 28 C 8 18, 16 14, 24 14 C 32 14, 40 18, 40 28 Z"
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
                values="0,0; 0,-1.5; 0,0"
                dur="1.4s"
                repeatCount="1"
              />
            )}
            <path d="M 16 22 A 2.5 2.5 0 0 1 20 22.5" />
            <path d="M 28 20 A 2.5 2.5 0 0 1 32 21" />
            <path d="M 22 25 A 2.5 2.5 0 0 1 26 25.5" />
          </g>
        </g>

        {/* BOWL */}
        <g id="bowl" fill="#E06B6B">
          <path d="M 19 43 L 19 45.5 C 19 46.5, 29 46.5, 29 45.5 L 29 43 Z" />
          <path d="M 8 28 C 8 41, 14 43, 24 43 C 34 43, 40 41, 40 28 Z" />
        </g>
      </g>
    </svg>
  );
}
