import type { Metadata } from "next";
import { type StaticImageData } from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ScreenshotFrame as Frame } from "@/components/ScreenshotFrame";
import feedShot from "@/assets/landing/feed.png";
import newStoryShot from "@/assets/landing/new-story.png";
import mediaShot from "@/assets/landing/media.png";
import reviewShot from "@/assets/landing/review.png";
import templateShot from "@/assets/landing/template-builder.png";

/**
 * Public landing page (front only) — what people land on when they come from
 * GitHub. The middleware lets anonymous visitors through on "/" and sends
 * anyone with a session straight to the dashboard, as it always did.
 * English on purpose: it is the project's storefront, not the app UI.
 */
const GITHUB_URL = "https://github.com/MatheusBomtempo/JornAI";
const DESCRIPTION =
  "Open-source tool that turns a source into an Instagram-ready post in minutes. AI writes the copy, a human always approves.";

export const metadata: Metadata = {
  title: "JornAI — from source to Instagram in minutes",
  description: DESCRIPTION,
  openGraph: {
    title: "JornAI — from source to Instagram in minutes",
    description: DESCRIPTION,
    type: "website",
    images: [{ url: feedShot.src, width: feedShot.width, height: feedShot.height }],
  },
  twitter: { card: "summary_large_image" },
};

const STEPS: {
  n: string;
  title: string;
  text: string;
  image: StaticImageData;
  alt: string;
}[] = [
  {
    n: "01",
    title: "Drop in your source",
    text: "Paste a text, an article link or a PDF. Credit the photographer or the source. The AI writes the title, subtitle and caption — and never touches the photo.",
    image: newStoryShot,
    alt: "New story screen with a pasted link and the Generate button",
  },
  {
    n: "02",
    title: "Frame the photo, tweak the words",
    text: "Drag and zoom the photo, move the title and subtitle, edit the text. The brand template stays intact, and what you see is exactly what the server renders. Video posts get the same care.",
    image: mediaShot,
    alt: "Editor with the photo framed on the brand template",
  },
  {
    n: "03",
    title: "Review, then publish",
    text: "See the post exactly as it will look on Instagram. Approve and publish, ask for a rewrite, or reject with a reason. Every change is a new version — nothing is overwritten.",
    image: reviewShot,
    alt: "Review screen with an Instagram-style preview and the approve, rewrite and reject actions",
  },
];

const FEATURES: { icon: string; title: string; text: string }[] = [
  {
    icon: "🧾",
    title: "Fact-first",
    text: "Sources are cleaned and redacted before the model sees them, and the output is checked against the source after.",
  },
  {
    icon: "👀",
    title: "Always human-approved",
    text: "Nothing reaches Instagram without a person pressing approve. Peer review and roles included.",
  },
  {
    icon: "🎨",
    title: "Your brand, every time",
    text: "Photo and text compose on your own template — in the browser and on the server, pixel for pixel.",
  },
  {
    icon: "🎬",
    title: "Photo and Reels",
    text: "Videos are normalized to 9:16, kept inside Instagram's safe zones and get an animated title card.",
  },
  {
    icon: "🌍",
    title: "Any language",
    text: "One environment variable picks the working language. English and Portuguese ship as examples; add yours with a small pack.",
  },
  {
    icon: "🆓",
    title: "Open source, runs with no keys",
    text: "MIT licensed. A mock AI mode and local storage let you try the whole flow without any external service.",
  },
];

const PIPELINE: { label: string; text: string }[] = [
  { label: "Clean", text: "Deterministic cleanup and field extraction — no AI." },
  { label: "Redact", text: "Names, IDs, phones and plates removed before the model." },
  { label: "Write", text: "Strict prompt: no invented details, no filler." },
  { label: "Validate", text: "A rule-based check against the source, then one corrective retry." },
];

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* Decorative grid + glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%)",
        }}
      />

      <Header />

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center md:pt-24">
          <a
            href={GITHUB_URL}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-white/30 hover:text-ink"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Open source · MIT licensed
            <span aria-hidden="true">→</span>
          </a>

          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            From source to Instagram in{" "}
            <span className="font-masthead font-extrabold">minutes.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted md:text-lg">
            AI writes the copy. A human always approves. Built for newsrooms that can&apos;t
            afford to get the facts wrong.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary h-12 px-6 text-base">
              Sign in to the app
            </Link>
            <a href={GITHUB_URL} className="btn-ghost h-12 px-6 text-base">
              <GitHubMark /> Star on GitHub
            </a>
          </div>

          <div className="relative mx-auto mt-16 max-w-5xl">
            <div
              aria-hidden="true"
              className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_65%)]"
            />
            <Frame image={feedShot} alt="JornAI story feed with posts waiting for review" priority />
          </div>
        </section>

        {/* Trust strip */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <ul className="grid gap-3 text-sm text-muted sm:grid-cols-3">
            {[
              "Real photos only — the AI never generates images",
              "Every version saved, nothing overwritten",
              "Nothing publishes without a human",
            ].map((t) => (
              <li
                key={t}
                className="rounded-xl border border-lineSoft bg-surface/60 px-4 py-3 text-center"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* Steps */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <SectionTitle kicker="How it works" title="Three steps. One human in the loop." />
          <div className="mt-14 space-y-20 md:space-y-28">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
              >
                <div className={i % 2 === 1 ? "md:order-2" : ""}>
                  <span className="font-mono text-sm text-faint">{s.n}</span>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                    {s.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted">{s.text}</p>
                </div>
                <div className={i % 2 === 1 ? "md:order-1" : ""}>
                  <Frame image={s.image} alt={s.alt} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionTitle kicker="Why JornAI" title="Fast, but never reckless." />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card p-6 transition-colors hover:border-white/25"
              >
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fact pipeline */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionTitle
            kicker="Fact-accuracy pipeline"
            title="A confident article with wrong facts is worse than no article."
          />
          <ol className="mt-12 grid gap-4 md:grid-cols-4">
            {PIPELINE.map((p, i) => (
              <li key={p.label} className="card relative p-6">
                <span className="font-mono text-xs text-faint">0{i + 1}</span>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{p.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Templates */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
            <div>
              <SectionTitle
                align="left"
                kicker="Make it yours"
                title="Your frame. Your fonts. Your newsroom."
              />
              <p className="mt-4 text-base leading-relaxed text-muted">
                Upload your brand frame, drag the title and subtitle boxes where you want them,
                and choose size, color, weight and alignment. Teach the AI your tone with a few
                real posts. Set it up once; every post comes out on brand.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                {[
                  "Portrait 4:5 or square 1:1 templates",
                  "Company logo, handle and brand colors",
                  "Newsroom style: the AI learns tone and format, never the content",
                  "Admin, manager and reporter roles, each company isolated",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="text-ink">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <Frame image={templateShot} alt="Template builder with draggable title and subtitle boxes" />
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-4 pb-24 pt-10 text-center">
          <div className="rounded-3xl border border-line bg-surface/80 px-6 py-14 shadow-soft md:px-12">
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
              Ship the story, not the busywork.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">
              Clone it, run it with no keys, and publish your first post today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={GITHUB_URL} className="btn-primary h-12 px-6 text-base">
                <GitHubMark /> View on GitHub
              </a>
              <Link href="/login" className="btn-ghost h-12 px-6 text-base">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-faint sm:flex-row">
          <Logo size="sm" />
          <p>MIT licensed · Built in the open.</p>
          <div className="flex gap-5">
            <a href={GITHUB_URL} className="hover:text-ink">
              GitHub
            </a>
            <Link href="/about" className="hover:text-ink">
              Guide
            </Link>
            <a href={`${GITHUB_URL}/blob/main/SPEC.md`} className="hover:text-ink">
              Spec
            </a>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="JornAI">
          <Logo size="sm" />
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/about" className="btn-subtle btn-sm hidden sm:inline-flex">
            How it works
          </Link>
          <a href={GITHUB_URL} className="btn-ghost btn-sm">
            <GitHubMark /> GitHub
          </a>
          <Link href="/login" className="btn-primary btn-sm">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SectionTitle({
  kicker,
  title,
  align = "center",
}: {
  kicker: string;
  title: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">{kicker}</p>
      <h2
        className={`mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl ${
          align === "center" ? "mx-auto max-w-3xl" : ""
        }`}
      >
        {title}
      </h2>
    </div>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
