import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { getServerDictionary } from "@/lib/i18n/server";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ActionOverlayProvider } from "@/components/ActionOverlay";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Poppins is the art's font — used in the editor preview to match the server
// render exactly.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-art",
});

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return {
    title: dict.rootMetadata.title,
    description: dict.rootMetadata.description,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0c10",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = await getServerDictionary();
  return (
    <html
      lang={locale === "pt" ? "pt-BR" : "en"}
      className={`dark ${inter.variable} ${poppins.variable}`}
    >
      <body className="font-sans antialiased">
        <LocaleProvider initialLocale={locale}>
          <ActionOverlayProvider>{children}</ActionOverlayProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
