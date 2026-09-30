// Lets `import img from "./x.png"` typecheck even before Next generates
// next-env.d.ts (a fresh checkout, e.g. in CI, runs `tsc` before `next build`).
/// <reference types="next/image-types/global" />
