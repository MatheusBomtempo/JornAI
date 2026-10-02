import type { Metadata } from "next";
import Link from "next/link";
import { getServerDictionary } from "@/lib/i18n/server";
import { GITHUB_CLONE_CMD, GITHUB_URL } from "@/lib/links";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ScreenshotFrame } from "@/components/ScreenshotFrame";
import { BlobBackground } from "@/components/BlobBackground";
import { GitHubMark } from "@/components/GitHubMark";
import newStoryShot from "@/assets/landing/new-story.png";
import mediaShot from "@/assets/landing/media.png";
import reviewShot from "@/assets/landing/review.png";
import feedShot from "@/assets/landing/feed.png";
import templateShot from "@/assets/landing/template-builder.png";
import adminTabsShot from "@/assets/landing/admin-tabs.png";
import videoShot from "@/assets/landing/video-editor.png";

/**
 * /about — plain-language guide to how the system works. Follows the
 * interface language like the rest of the app. JornAI is open source, so the
 * page pushes people to clone the repo and run their own instance instead of
 * opening the dashboard that happens to be hosted here: every call to action
 * points to GitHub, none to the sign-in.
 */
const STEP_SHOTS = [newStoryShot, mediaShot, reviewShot, feedShot];

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.about.metaTitle, description: dict.about.metaDescription };
}

export default async function AboutPage() {
  const { dict } = await getServerDictionary();
  const t = dict.about;

  return (
    <div className="relative overflow-hidden">
      <BlobBackground />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%)",
        }}
      />

      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="JornAI">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <a href={GITHUB_URL} className="btn-primary btn-sm">
              <GitHubMark /> {t.cloneCta}
            </a>
          </div>
        </div>
      </header>

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 pb-6 pt-16 text-center md:pt-24">
          <a
            href={GITHUB_URL}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-white/30 hover:text-ink"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {t.badge}
            <span aria-hidden="true">→</span>
          </a>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-faint">{t.kicker}</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted md:text-lg">
            {t.subtitle}
          </p>

          <CloneCard title={t.ossTitle} text={t.ossText} steps={t.ossSteps} cta={t.cloneCta} />

          {/* Step index */}
          <ol className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
            {t.steps.map((s, i) => (
              <li key={s.title}>
                <a
                  href={`#step-${i + 1}`}
                  className="block h-full rounded-xl border border-lineSoft bg-surface/70 px-3 py-2.5 text-sm backdrop-blur transition-colors hover:border-white/30"
                >
                  <span className="font-mono text-xs text-faint">0{i + 1}</span>
                  <span className="mt-0.5 block font-medium leading-snug">{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="space-y-20 md:space-y-28">
            {t.steps.map((s, i) => (
              <article
                key={s.title}
                id={`step-${i + 1}`}
                className="grid scroll-mt-24 items-center gap-8 md:grid-cols-2 md:gap-14"
              >
                <div className={i % 2 === 1 ? "md:order-2" : ""}>
                  <span className="font-mono text-sm text-faint">
                    {t.stepLabel} 0{i + 1}
                  </span>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                    {s.title}
                  </h2>
                  <Lead>{s.tldr}</Lead>
                  <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-muted">
                    {s.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <span className="text-ink">→</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={i % 2 === 1 ? "md:order-1" : ""}>
                  <ScreenshotFrame image={STEP_SHOTS[i]} alt={s.alt} priority={i === 0} />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Video */}
        <section id="video" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">
              {t.videoKicker}
            </p>
            <h2 className="mx-auto mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">
              {t.videoTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-base leading-relaxed text-muted md:text-lg">
              {t.videoLead}
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <ScreenshotFrame image={videoShot} alt={t.videoAlt} />
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.videoFeatures.map((f) => (
              <div key={f.title} className="card p-6">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rules */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
            {t.rulesTitle}
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {t.rules.map((r) => (
              <div key={r.title} className="card p-6">
                <h3 className="text-lg font-semibold">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
            {t.rolesTitle}
          </h2>
          <div className="mx-auto mt-10 max-w-3xl divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {t.roles.map((r) => (
              <div key={r.name} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
                <span className="w-28 shrink-0 font-semibold">{r.name}</span>
                <span className="text-sm leading-relaxed text-muted">{r.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Admin setup */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t.setupTitle}</h2>
              <Lead>{t.setupTldr}</Lead>
              <ol className="mt-6 space-y-4">
                {t.setup.map((s, i) => (
                  <li key={s.name} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs text-muted">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-5">
              <figure>
                <ScreenshotFrame image={adminTabsShot} alt={t.tabsAlt} />
                <figcaption className="mt-3 text-center text-sm text-faint">
                  {t.tabsCaption}
                </figcaption>
              </figure>
              <ScreenshotFrame image={templateShot} alt={t.setupAlt} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-4 pb-24 pt-8 text-center">
          <div className="rounded-3xl border border-line bg-surface/80 px-6 py-12 shadow-soft backdrop-blur">
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              {t.ctaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">{t.ctaText}</p>
            <CloneCommand />
            <a href={GITHUB_URL} className="btn-primary mt-7 h-12 px-6 text-base">
              <GitHubMark /> {t.cloneCta}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Lead sentence under a heading — just the text, no label. */
function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-base leading-relaxed text-ink md:text-lg">{children}</p>;
}

function CloneCommand() {
  return (
    <pre className="mx-auto mt-6 max-w-full overflow-x-auto rounded-xl border border-line bg-bg/80 px-4 py-3 text-left font-mono text-xs text-ink sm:w-fit sm:text-sm">
      <code className="select-all">{GITHUB_CLONE_CMD}</code>
    </pre>
  );
}

function CloneCard({
  title,
  text,
  steps,
  cta,
}: {
  title: string;
  text: string;
  steps: { name: string; text: string }[];
  cta: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-line bg-surface/80 p-6 text-left shadow-soft backdrop-blur md:p-8">
      <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">{text}</p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.name} className="rounded-xl border border-lineSoft bg-bg/60 p-4">
            <span className="font-mono text-xs text-faint">0{i + 1}</span>
            <p className="mt-1 font-semibold">{s.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
      <CloneCommand />
      <div className="mt-5 text-center">
        <a href={GITHUB_URL} className="btn-primary h-11 px-5">
          <GitHubMark /> {cta}
        </a>
      </div>
    </div>
  );
}
