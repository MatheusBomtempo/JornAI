import Link from "next/link";
import { getServerDictionary } from "@/lib/i18n/server";
import { Logo } from "@/components/Logo";

export default async function NotFound() {
  const { dict } = await getServerDictionary();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo size="lg" />
      <p className="text-muted">{dict.notFound.message}</p>
      <Link href="/dashboard" className="btn-primary">
        {dict.notFound.backToFeed}
      </Link>
    </div>
  );
}
