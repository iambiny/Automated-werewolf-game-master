import { ImageResponse } from 'next/og';

export const size = {
  height: 180,
  width: 180,
};

export const contentType = 'image/png';

/**
 * Safari does not use SVGs from the web manifest for Home Screen icons. Next
 * turns this route into both a PNG response and the required
 * `apple-touch-icon` metadata link.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width="180"
        height="180"
      >
        <rect width="512" height="512" rx="112" fill="#090b12" />
        <circle cx="256" cy="250" r="164" fill="#d6b36a" />
        <path
          d="M108 121l96 72 52-105 52 105 96-72-44 193-104 110-104-110z"
          fill="#171a25"
        />
        <path d="M175 255l55 21-66 32zm162 0l-55 21 66 32z" fill="#d6b36a" />
        <path d="M221 348h70l-35 43z" fill="#d6b36a" />
      </svg>
    ),
    size,
  );
}
