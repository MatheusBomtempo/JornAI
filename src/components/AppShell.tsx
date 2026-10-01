"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { type UserRole } from "@/lib/domain";
import { ChangePasswordBanner } from "./ChangePasswordBanner";
import { useLocale } from "./LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";

interface Props {
  user: { name: string; role: UserRole; mustSetPassword?: boolean };
  children: React.ReactNode;
}

export function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { dict } = useLocale();

  const NAV = [
    { href: "/dashboard", label: dict.appShell.navFeed, icon: FeedIcon },
    { href: "/capture", label: dict.appShell.navNewStory, icon: PlusIcon },
    {
      href: "/admin",
      label: dict.appShell.navAdmin,
      icon: GearIcon,
      // Staff gets in too (style/templates) — AdminPanel restricts the rest by role.
      roles: ["admin", "manager", "staff"] as UserRole[],
    },
  ];
  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role));

  async function logout() {
    await apiPost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh">
      {/* Topo */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4">
          <Link href="/dashboard" aria-label="JornAI">
            <Logo size="sm" />
          </Link>

          {/* Nav desktop */}
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-elevated text-ink ring-1 ring-inset ring-line"
                      : "text-muted hover:bg-elevated hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <Link
              href="/about"
              title={dict.appShell.help}
              aria-label={dict.appShell.help}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-sm font-semibold text-muted transition-colors hover:border-white/30 hover:text-ink"
            >
              ?
            </Link>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted">{dict.common.role[user.role]}</div>
            </div>
            <button
              onClick={logout}
              title={dict.appShell.logout}
              aria-label={dict.appShell.logout}
              className="btn-ghost btn-sm w-9 px-0 sm:w-auto sm:px-3"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">{dict.appShell.logout}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Extra space at the bottom for the fixed mobile navigation bar */}
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
        {user.mustSetPassword && <ChangePasswordBanner />}
        {children}
      </main>

      {/* Nav inferior (mobile) — "new story" is the main action, so it gets the center spotlight */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="flex items-end">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            const primary = item.href === "/capture";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {primary ? (
                  <span
                    className={`-mt-6 flex h-12 w-12 items-center justify-center rounded-full shadow-soft ring-4 ring-bg transition-transform active:scale-95 ${
                      active ? "bg-white text-black" : "bg-white/90 text-black"
                    }`}
                  >
                    <PlusIcon />
                  </span>
                ) : (
                  <>
                    {active && (
                      <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-white" />
                    )}
                    <Icon active={active} />
                  </>
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function FeedIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3" y="3" width="18" height="18" rx="4"
        stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0}
      />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlusIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12" cy="12" r="9"
        stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0}
      />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12" cy="12" r="3.2"
        stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0}
      />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.04a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.02Z"
        stroke="currentColor" strokeWidth="1.4"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
