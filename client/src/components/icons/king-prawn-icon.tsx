import type { AnimatedIconProps } from "./chicken-icon";

export function KingPrawnIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <g transform="translate(1.5, -2) scale(0.85)">
        <g id="prawn-global">
          {isAnimating && (
            <>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0; -3,2.5; 0.5,-0.5; 0,0; 0,0"
                keyTimes="0; 0.15; 0.35; 0.5; 1"
                dur="1.4s"
                repeatCount="1"
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 26 26; -10 26 26; 3 26 26; 0 26 26; 0 26 26"
                keyTimes="0; 0.15; 0.35; 0.5; 1"
                dur="1.4s"
                repeatCount="1"
                additive="sum"
              />
            </>
          )}

          {/* Antennae */}
          <g id="antennae">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 18 18; 25 18 18; -12 18 18; 4 18 18; 0 18 18; 0 18 18"
                keyTimes="0; 0.15; 0.35; 0.5; 0.65; 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}
            <path
              d="M 18,17 C 8,17 8,9 18,9 L 34,9"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 18,21 C 12,21 12,25 18,25 L 24,25"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Legs */}
          <g id="legs">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 22 22; -35 22 22; 5 22 22; 0 22 22; 0 22 22"
                keyTimes="0; 0.15; 0.35; 0.5; 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}
            <path
              d="M 22,22 L 19,26 L 20,30"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 26,22 L 23,26 L 24,30"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 30,24 L 27,28 L 28,32"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Tail fins */}
          <g id="tail-fins">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 25 41; 40 25 41; -10 25 41; 0 25 41; 0 25 41"
                keyTimes="0; 0.1; 0.3; 0.5; 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}
            <path
              d="M 25,41 C 15,37 13,47 19,49 C 23,49 26,45 25,41 Z"
              fill="#FF723F"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 24,42 C 18,48 24,56 30,52 C 32,48 28,43 24,42 Z"
              fill="#FF723F"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Body */}
          <g id="body">
            <path
              d="M 18,16 
                 C 32,16 44,20 44,32 
                 C 44,42 34,46 26,44 
                 L 24,38 
                 C 30,38 34,36 34,28 
                 C 34,22 26,22 18,22 
                 A 3 3 0 0 1 18 16 Z"
              fill="#FF723F"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d="M 26,16.5 L 24.5,22"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 34,19 L 29,26"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 40.5,23.5 L 34,28"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 43,34.5 L 34,33"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 38,42 L 29,37.5"
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}
