import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Basic hardening headers on every response. No CSP on purpose: Next injects
// inline scripts and the editor loads remote images, so a strict CSP needs its
// own careful pass (nonces) to avoid breaking the app.
const SECURITY_HEADERS = [
  // Nobody can embed the app in an iframe (clickjacking on the approve button).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Prevents Next from inferring the wrong root when there is another lockfile above.
  outputFileTracingRoot: __dirname,
  // Sharp does the final art render; unpdf (pdf.js) extracts text from PDFs;
  // fluent-ffmpeg + @ffmpeg-installer/ffmpeg render the video with the animated
  // text. All of them run only on the server and must not be bundled.
  serverExternalPackages: [
    "sharp",
    "unpdf",
    "opentype.js",
    "fluent-ffmpeg",
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
  ],
  // render/text.ts reads the Poppins .woff files via fs.readFile with a path
  // built at runtime (not a literal import/require) — Next's tracer does not
  // detect that access by itself and left the font out of the serverless
  // function bundle (it worked locally, broke only on Vercel). Same problem
  // with the ffmpeg binary (resolved at runtime by the installer).
  //
  // "/**/*" (not just "/api/**/*"): services/posts.ts imports render/video.ts
  // at the top of the file, and regular pages (e.g. /dashboard, /posts/[id])
  // import services/posts.ts to list/load posts — so the require of
  // @ffprobe-installer/ffprobe also lands in the bundle of THOSE pages, not
  // only of the /api routes. Scoping to /api alone left /dashboard broken in
  // production with "Cannot find module '@ffprobe-installer/linux-x64/ffprobe'".
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/@fontsource/poppins/files/**",
      "./node_modules/@ffmpeg-installer/**",
      "./node_modules/@ffprobe-installer/**",
    ],
  },
  images: {
    // Permite exibir fotos/arte hospedadas no storage configurado.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
