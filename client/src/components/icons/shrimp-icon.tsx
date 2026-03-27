import type { AnimatedIconProps } from "./chicken-icon";

export function ShrimpIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <g transform="rotate(10 24 24)">
        <g style={{ transformOrigin: "22px 24px" }}>
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0; -5; 16; -3; 2; 0"
              keyTimes="0; 0.3; 0.45; 0.6; 0.8; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              dur="1.4s"
              repeatCount="1"
            />
          )}

          <g style={{ transformOrigin: "22px 24px" }}>
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; 1.03 0.95; 0.82 1.08; 1.02 0.98; 0.98 1.02; 1 1"
                keyTimes="0; 0.3; 0.45; 0.6; 0.8; 1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}

            <path
              d="M 28 14
                 C 16 12, 8 20, 10 28
                 C 12 36, 22 40, 32 34
                 A 3.5 3.5 0 0 0 30 28
                 C 22 32, 16 28, 16 22
                 C 16 16, 22 15, 26 17
                 A 2 2 0 0 0 28 14
                 Z"
              fill="#FFC2A6"
              stroke="#E86A4F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d="M 11.5 22 Q 10.5 25 11.5 28"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {isAnimating && (
                <animate
                  attributeName="opacity"
                  values="0.4; 0.9; 0.2; 0.6; 0.4"
                  keyTimes="0; 0.3; 0.45; 0.6; 1"
                  dur="1.4s"
                  repeatCount="1"
                />
              )}
            </path>

            <g stroke="#E86A4F" strokeWidth="2" strokeLinecap="round">
              <path d="M 13.5 17.5 L 16.5 18.5" />
              <path d="M 10.5 25 L 16 24.5" />
              <path d="M 13.5 33 L 21.5 29.5" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
