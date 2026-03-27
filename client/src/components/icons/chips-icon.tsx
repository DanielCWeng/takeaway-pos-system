import type { AnimatedIconProps } from "./chicken-icon";

export function ChipsIcon({ isAnimating, ...props }: AnimatedIconProps) {
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
        id="chips-icon"
        stroke="#3D2424"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* TOP RIM */}
        <path d="M 12 26 Q 24 22 36 26 Q 24 32 12 26 Z" fill="#D14343">
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-1; 0,1.5; 0,1.5; 0,-0.5; 0,0; 0,0"
              keyTimes="0; 0.15; 0.35; 0.45; 0.6; 0.7; 1"
              dur="1.4s"
              repeatCount="1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0 0 0.2 1; 0.4 0 0.6 1; 0.8 0 1 1; 0 0 0.2 1; 0 0 1 1"
            />
          )}
        </path>

        {/* FRIES */}
        <g id="fries">
          {/* RIGHT FRY */}
          <g>
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 31.5 30; -2 31.5 30; 12 31.5 30; 12 31.5 30; -2 31.5 30; 0 31.5 30; 0 31.5 30"
                keyTimes="0; 0.15; 0.35; 0.45; 0.6; 0.7; 1"
                dur="1.4s"
                repeatCount="1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0 0 0.2 1; 0.4 0 0.6 1; 0.8 0 1 1; 0 0 0.2 1; 0 0 1 1"
              />
            )}
            <rect x="29" y="13" width="5" height="21" rx="2.5" fill="#FFD24D" />
          </g>

          {/* LEFT FRY */}
          <g>
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 16.5 30; 2 16.5 30; -10 16.5 30; -10 16.5 30; 2 16.5 30; 0 16.5 30; 0 16.5 30"
                keyTimes="0; 0.15; 0.35; 0.45; 0.6; 0.7; 1"
                dur="1.4s"
                repeatCount="1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0 0 0.2 1; 0.4 0 0.6 1; 0.8 0 1 1; 0 0 0.2 1; 0 0 1 1"
              />
            )}
            <rect x="14" y="14" width="5" height="20" rx="2.5" fill="#FFD24D" />
          </g>

          {/* MIDDLE FRY */}
          <g>
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0; 0,2; 0,-8; 0,-8; 0,1.5; 0,0; 0,0"
                keyTimes="0; 0.15; 0.35; 0.45; 0.6; 0.7; 1"
                dur="1.4s"
                repeatCount="1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0 0 0.2 1; 0.4 0 0.6 1; 0.8 0 1 1; 0 0 0.2 1; 0 0 1 1"
              />
            )}
            <rect
              x="21.5"
              y="10"
              width="5"
              height="24"
              rx="2.5"
              fill="#FFD24D"
            />
          </g>
        </g>

        {/* CUP BODY */}
        <path
          d="M 12 26 Q 24 32 36 26 L 34 42 A 2 2 0 0 1 32 44 L 16 44 A 2 2 0 0 1 14 42 Z"
          fill="#FF5C5C"
        >
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-1; 0,1.5; 0,1.5; 0,-0.5; 0,0; 0,0"
              keyTimes="0; 0.15; 0.35; 0.45; 0.6; 0.7; 1"
               dur="1.4s"
               repeatCount="1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0 0 0.2 1; 0.4 0 0.6 1; 0.8 0 1 1; 0 0 0.2 1; 0 0 1 1"
            />
          )}
        </path>
      </g>
    </svg>
  );
}
