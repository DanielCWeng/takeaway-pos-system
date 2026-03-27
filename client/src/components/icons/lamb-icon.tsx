import type { AnimatedIconProps } from "./chicken-icon";

export function LambIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      {...props}
    >
      <ellipse cx="24" cy="43" rx="14" ry="2" fill="#4A3B32" opacity="0.1" />

      <g
        id="lamb-legs-far"
        fill="#D6C5B3"
        stroke="#4A3B32"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <rect x="18" y="28" width="3" height="13" rx="1.5" />
        <rect x="31" y="28" width="3" height="13" rx="1.5" />
      </g>

      <g
        id="lamb-legs-near"
        fill="#D6C5B3"
        stroke="#4A3B32"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <rect x="15" y="30" width="3" height="12" rx="1.5" />
        <rect x="28" y="30" width="3" height="12" rx="1.5" />
      </g>

      <g id="lamb-upper-body">
        {isAnimating && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; -1,1; -1,0.5; -1.5,1.5; -1,0.5; -1,1; 0.5,-0.5; 0,0"
            keyTimes="0; 0.14; 0.21; 0.32; 0.43; 0.5; 0.64; 1"
            dur="1.4s"
            repeatCount="1"
            begin="0s"
          />
        )}

        <path
          d="M 36 26 A 4 4 0 0 1 43 29 A 4 4 0 0 1 36 32"
          fill="#F4F0EB"
          stroke="#4A3B32"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        <path
          d="M 16 34 
             A 5.5 5.5 0 0 1 12 26 
             A 8 8 0 0 1 24 18 
             A 8 8 0 0 1 36 24 
             A 6 6 0 0 1 36 34 Z"
          fill="#F4F0EB"
          stroke="#4A3B32"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        <path
          d="M 22 28 A 2 2 0 0 1 26 28 A 2 2 0 0 0 30 28 M 18 22 A 1.5 1.5 0 0 1 21 22"
          fill="none"
          stroke="#4A3B32"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.25"
        />

        <g id="lamb-head">
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 18 25; -35 18 25; -30 18 25; -38 18 25; -32 18 25; -35 18 25; 5 18 25; 0 18 25"
              keyTimes="0; 0.14; 0.21; 0.32; 0.43; 0.5; 0.64; 1"
              dur="1.4s"
              repeatCount="1"
              begin="0s"
            />
          )}

          <rect
            x="5"
            y="19"
            width="16"
            height="12"
            rx="6"
            fill="#D6C5B3"
            stroke="#4A3B32"
            strokeWidth="2"
          />

          <circle cx="11" cy="26" r="2.5" fill="#E8A2A8" opacity="0.6" />

          <ellipse cx="9" cy="23" rx="1.5" ry="1.5" fill="#4A3B32">
            {isAnimating && (
              <animate
                attributeName="ry"
                values="1.5; 1.5; 0.1; 1.5"
                keyTimes="0; 0.7; 0.8; 1"
                dur="1.4s"
                repeatCount="1"
                begin="0s"
              />
            )}
          </ellipse>

          <g id="lamb-ear">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 17 21; 20 17 21; -10 17 21; 0 17 21; -25 17 21; 15 17 21; 0 17 21"
                keyTimes="0; 0.15; 0.3; 0.5; 0.7; 0.85; 1"
                dur="1.4s"
                repeatCount="1"
                begin="0s"
              />
            )}

            <path
              d="M 17 21 C 23 19 27 23 25 28 C 23 30 19 28 17 24 Z"
              fill="#D6C5B3"
              stroke="#4A3B32"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M 18 22.5 C 22 21 25 24 23.5 27 C 22.5 28 20 27 18 24.5 Z"
              fill="#E8A2A8"
            />
          </g>

          <path
            id="lamb-wool-cap"
            d="M 10 20 
               A 4 4 0 0 1 14 15 
               A 4 4 0 0 1 19 16 
               A 4 4 0 0 1 21 21 
               A 3 3 0 0 1 16 23 
               A 4 4 0 0 1 10 20 Z"
            fill="#F4F0EB"
            stroke="#4A3B32"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
