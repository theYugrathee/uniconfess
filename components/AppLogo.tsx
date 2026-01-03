import React from 'react';

export const AppLogo = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="appLogoGradient" x1="0" y1="0" x2="100" y2="100">
                <stop stopColor="#FF4500" />
                <stop offset="1" stopColor="#FF8C00" />
            </linearGradient>

            <mask id="maskEyes">
                <rect width="100" height="100" fill="white" />
                {/* Mask Eye Cutouts - These will "punch holes" through whatever uses this mask */}
                <ellipse cx="40" cy="55" rx="5" ry="3" fill="black" />
                <ellipse cx="60" cy="55" rx="5" ry="3" fill="black" />
            </mask>

            <filter id="premiumGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        <g filter="url(#premiumGlow)">
            {/* The Icon Background - Minimal Squircle Shape */}
            <rect width="90" height="90" x="5" y="5" rx="22" fill="url(#appLogoGradient)" />

            <g mask="url(#maskEyes)">
                {/* Main Logo Shape - Smooth University Cap Top */}
                <path
                    d="M50 20L85 38L50 56L15 38L50 20Z"
                    fill="white"
                />

                {/* Smooth Confession Bubble / Cap Base Fusion */}
                <path
                    d="M28 42V62C28 74 38 80 50 80C62 80 72 74 72 62V42H28Z"
                    fill="white"
                />

                {/* Chat Tail Detail */}
                <path
                    d="M50 80L40 92L40 80H50Z"
                    fill="white"
                />
            </g>

            {/* Elegant Tassel Detail */}
            <path
                d="M85 38V55"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <circle cx="85" cy="55" r="3.5" fill="white" />

            {/* Subtle Shine Accent */}
            <path
                d="M50 28L70 38L50 48L30 38L50 28Z"
                fill="white"
                fillOpacity="0.2"
            />
        </g>
    </svg>
);
