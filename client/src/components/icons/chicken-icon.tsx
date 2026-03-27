import type { SVGProps } from "react";

export interface AnimatedIconProps extends SVGProps<SVGSVGElement> {
  isAnimating?: boolean;
}

export function ChickenIcon({ isAnimating, ...props }: AnimatedIconProps) {
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
        id="chicken-icon"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0, 10)"
      >
        <g id="legs" stroke="#332D27" strokeWidth="2" fill="none">
          <path d="M 18 26 L 18 40 L 15 42 M 18 40 L 21 42" />
          <path d="M 25 26 L 25 40 L 22 42 M 25 40 L 28 42" />
        </g>
        <g id="chicken-rig">
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 22 34; -15 22 34; 55 22 34; 35 22 34; 60 22 34; 60 22 34; -20 22 34; -20 22 34; 0 22 34; 0 22 34"
              keyTimes="0; 0.15; 0.25; 0.32; 0.40; 0.50; 0.65; 0.80; 0.90; 1"
              calcMode="spline"
              keySplines="0.25 0.1 0.25 1; 0.4 0 0.2 1; 0.25 0.1 0.25 1; 0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1; 0 0 1 1; 0.25 0.1 0.25 1; 0 0 1 1"
              dur="1.4s"
              repeatCount="1"
              begin="0s"
            />
          )}

          <path
            id="tail"
            d="M 12 20 L 4 18 C 3 20 5 23 8 23 L 3 25 C 3 27 6 29 12 28"
            fill="#FEF7ED"
            stroke="#332D27"
            strokeWidth="2"
          />

          <g id="comb" fill="#E86A58" stroke="#332D27" strokeWidth="2">
            <circle cx="28" cy="7" r="2.5" />
            <circle cx="33" cy="6" r="3" />
          </g>

          <path
            id="wattle"
            d="M 34 19 C 37 19 37 25 33 24 Z"
            fill="#E86A58"
            stroke="#332D27"
            strokeWidth="2"
          />

          <path
            id="beak"
            d="M 35 13 L 41 15 L 35 17 Z"
            fill="#F2A649"
            stroke="#332D27"
            strokeWidth="2"
          />

          <path
            id="body"
            d="M 18 34 A 8 8 0 0 1 10 26 L 10 22 A 8 8 0 0 1 18 14 L 24 14 A 6 6 0 0 1 30 8 A 6 6 0 0 1 36 14 L 36 20 A 14 14 0 0 1 22 34 Z"
            fill="#FEF7ED"
            stroke="#332D27"
            strokeWidth="2"
          />

          <path
            id="wing"
            d="M 15 23 Q 22 28 27 22"
            fill="none"
            stroke="#332D27"
            strokeWidth="2"
          >
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 15 23; -10 15 23; 20 15 23; -5 15 23; 30 15 23; 5 15 23; -15 15 23; -15 15 23; 0 15 23; 0 15 23"
                keyTimes="0; 0.15; 0.25; 0.32; 0.40; 0.50; 0.65; 0.80; 0.90; 1"
                calcMode="spline"
                keySplines="0.25 0.1 0.25 1; 0.4 0 0.2 1; 0.25 0.1 0.25 1; 0.4 0 0.2 1; 0.25 0.1 0.25 1; 0.4 0 0.2 1; 0 0 1 1; 0.25 0.1 0.25 1; 0 0 1 1"
                dur="1.4s"
                repeatCount="1"
                begin="0s"
              />
            )}
          </path>

          <g id="eye-position" transform="translate(32, 12)">
            <g id="eye-scale">
              <circle cx="0" cy="0" r="1.5" fill="#332D27" stroke="none" />
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1 1; 1 1; 1 0.1; 1 1; 1 1; 1 0.1; 1 1; 1 1"
                  keyTimes="0; 0.05; 0.08; 0.11; 0.45; 0.48; 0.51; 1"
                  dur="1.4s"
                  repeatCount="1"
                  begin="0s"
                />
              )}
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
