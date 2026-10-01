import type { Metadata } from "next";
import Link from "next/link";
import { getServerDictionary } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ScreenshotFrame } from "@/components/ScreenshotFrame";
import newStoryShot from "@/assets/landing/new-story.png";
import mediaShot from "@/assets/landing/media.png";
import reviewShot from "@/assets/landing/review.png";
import feedShot from "@/assets/landing/feed.png";
import templateShot from "@/assets/landing/template-builder.png";

/**
 * /about — plain-language guide to how the system works, for anyone in the
 * newsroom (logged in or not). Follows the interface language like the rest
 * of the app.
 */
const STEP_SHOTS = [newStoryShot, mediaShot, reviewShot, feedShot];

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.about.metaTitle, description: dict.about.metaDescription };
}

export default async function AboutPage() {
  const [{ dict }, session] = await Promise.all([getServerDictionary(), getSession()]);
  const t = dict.about;
  const cta = session
    ? { href: "/dashboard", label: t.goToFeed }
    : { href: "/login", label: t.signIn };

  return (
    <div className="relative overflow-hidden">
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
            <Link href={cta.href} className="btn-primary btn-sm">
              {cta.label}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 pb-6 pt-16 text-center md:pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">{t.kicker}</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted md:text-lg">
            {t.subtitle}
          </p>

          {/* Step index */}
          <ol className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
            {t.steps.map((s, i) => (
              <li key={s.title}>
                <a
                  href={`#step-${i + 1}`}
                  className="block h-full rounded-xl border border-lineSoft bg-surface/70 px-3 py-2.5 text-sm transition-colors hover:border-white/30"
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
                  <Tldr label={t.tldr}>{s.tldr}</Tldr>
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
              <Tldr label={t.tldr}>{t.setupTldr}</Tldr>
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
            <ScreenshotFrame image={templateShot} alt={t.setupAlt} />
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-4 pb-24 pt-8 text-center">
          <div className="rounded-3xl border border-line bg-surface/80 px-6 py-12 shadow-soft">
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              {t.ctaTitle}
            </h2>
            <Link href={cta.href} className="btn-primary mt-7 h-12 px-6 text-base">
              {cta.label}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Tldr({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface/80 px-4 py-3 text-base leading-relaxed">
      <span className="mt-0.5 shrink-0 rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-black">
        {label}
      </span>
      <span>{children}</span>
    </p>
  );
}
