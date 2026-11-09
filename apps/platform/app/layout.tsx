import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ServiceWorker } from "@/components/service-worker";
import { parseTheme, themeCookie } from "@/lib/preferences";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// TODO(owner): rename once the platform's product name is chosen (SPEC › Open decisions).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    icons: {
      icon: "/icons/favicon-32.png",
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// "Match device": set the class before the first paint, so there's no flash.
const followSystemTheme = `if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, cookieStore] = await Promise.all([getLocale(), cookies()]);
  const theme = parseTheme(cookieStore.get(themeCookie)?.value);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${theme === "dark" ? "dark" : ""}`}
    >
      <head>
        {theme === "system" && (
          <script dangerouslySetInnerHTML={{ __html: followSystemTheme }} />
        )}
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
