import type { AnimatedIconProps } from "./chicken-icon";

export function BeefIcon({ isAnimating, ...props }: AnimatedIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      overflow="visible"
      {...props}
    >
      <defs>
        <clipPath id="cow-body-clip">
          <path d="M 16 20 C 22 18, 30 18, 36 20 C 39 21, 40 25, 38 30 C 37 34, 35 36, 32 36 L 18 36 C 15 36, 14 32, 14 26 C 14 22, 15 21, 16 20 Z" />
        </clipPath>
      </defs>

      <g stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
        <g id="back-legs" fill="#E5D8CC" stroke="#42342A">
          <g>
            <rect x="13" y="32" width="4" height="10" rx="2" />
            <path d="M 13 39 L 17 39" />
          </g>
          <g>
            <rect x="27" y="32" width="4" height="10" rx="2" />
            <path d="M 27 39 L 31 39" />
          </g>
        </g>

        <g id="torso-group">
          {isAnimating && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0.5,0.5; 0.5,0.5; -0.5,-0.5; 0,0"
              keyTimes="0; 0.25; 0.6; 0.85; 1"
              dur="1.4s"
              repeatCount="1"
            />
          )}

          <g id="tail-group" transform-origin="37px 22px">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 37 22; -8 37 22; 4 37 22; 0 37 22"
                keyTimes="0; 0.4; 0.8; 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}
            <path d="M 37 22 Q 42 22, 42 28" fill="none" stroke="#42342A" />
            <path
              d="M 42 26 C 44 26, 45 31, 42 33 C 39 31, 40 26, 42 26 Z"
              fill="#42342A"
              stroke="#42342A"
            />
          </g>

          <g id="body">
            <path
              d="M 16 20 C 22 18, 30 18, 36 20 C 39 21, 40 25, 38 30 C 37 34, 35 36, 32 36 L 18 36 C 15 36, 14 32, 14 26 C 14 22, 15 21, 16 20 Z"
              fill="#F4EFEA"
              stroke="none"
            />

            <g clip-path="url(#cow-body-clip)" fill="#C1A68D" stroke="none">
              <circle cx="28" cy="18" r="7" />
              <circle cx="39" cy="28" r="5" />
              <circle cx="18" cy="34" r="4.5" />
            </g>

            <path
              d="M 16 20 C 22 18, 30 18, 36 20 C 39 21, 40 25, 38 30 C 37 34, 35 36, 32 36 L 18 36 C 15 36, 14 32, 14 26 C 14 22, 15 21, 16 20 Z"
              fill="none"
              stroke="#42342A"
            />
          </g>

          <g id="head-translate">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0; 1,1.5; 1,1.5; -0.5,-1; 0,0"
                keyTimes="0; 0.25; 0.6; 0.85; 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}

            <g id="head-rotate">
              {isAnimating && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 12 24; 10 12 24; 10 12 24; -4 12 24; 0 12 24"
                  keyTimes="0; 0.25; 0.6; 0.85; 1"
                  dur="1.4s"
                  repeatCount="1"
                />
              )}

              <path d="M 8 11 Q 5 6, 2 8" fill="none" stroke="#42342A" />
              <path d="M 16 11 Q 19 6, 22 8" fill="none" stroke="#42342A" />

              <g transform-origin="4px 16px">
                {isAnimating && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0; 0; -30; 0; -30; 0"
                    keyTimes="0; 0.7; 0.75; 0.8; 0.85; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
                <ellipse
                  cx="4"
                  cy="16"
                  rx="3.5"
                  ry="1.5"
                  transform="rotate(20 4 16)"
                  fill="#C1A68D"
                  stroke="#42342A"
                />
              </g>

              <g transform-origin="20px 16px">
                {isAnimating && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0; 0; 30; 0; 30; 0"
                    keyTimes="0; 0.7; 0.75; 0.8; 0.85; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
                <ellipse
                  cx="20"
                  cy="16"
                  rx="3.5"
                  ry="1.5"
                  transform="rotate(-20 20 16)"
                  fill="#C1A68D"
                  stroke="#42342A"
                />
              </g>

              <rect x="6" y="11" width="12" height="14" rx="4" fill="#F4EFEA" stroke="#42342A" />

              <ellipse cx="9" cy="15.5" rx="1" ry="1.5" fill="#42342A" stroke="none">
                {isAnimating && (
                  <animate
                    attributeName="ry"
                    values="1.5; 1.5; 0.2; 1.5; 1.5"
                    keyTimes="0; 0.45; 0.5; 0.55; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
              </ellipse>

              <ellipse cx="15" cy="15.5" rx="1" ry="1.5" fill="#42342A" stroke="none">
                {isAnimating && (
                  <animate
                    attributeName="ry"
                    values="1.5; 1.5; 0.2; 1.5; 1.5"
                    keyTimes="0; 0.45; 0.5; 0.55; 1"
                    dur="1.4s"
                    repeatCount="1"
                  />
                )}
              </ellipse>

              <rect x="5" y="19" width="14" height="7" rx="3.5" fill="#F2B8B8" stroke="#42342A" />

              <circle cx="9" cy="22.5" r="0.75" fill="#42342A" stroke="none" />
              <circle cx="15" cy="22.5" r="0.75" fill="#42342A" stroke="none" />
            </g>
          </g>
        </g>

        <g id="front-legs" fill="#F4EFEA" stroke="#42342A">
          <g>
            <rect x="31" y="33" width="4" height="10" rx="2" />
            <path d="M 31 40 L 35 40" />
          </g>

          <g id="stomp-leg">
            {isAnimating && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0; 0,0; 0,-3; 0,0; 0,0"
                keyTimes="0; 0.75; 0.85; 0.95; 1"
                dur="1.4s"
                repeatCount="1"
              />
            )}
            <rect x="17" y="33" width="4" height="10" rx="2" />
            <path d="M 17 40 L 21 40" />
          </g>
        </g>
      </g>
    </svg>
  );
}
