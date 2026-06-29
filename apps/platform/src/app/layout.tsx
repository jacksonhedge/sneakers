import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import { Footer } from "./footer";
import { PageViewTracker } from "@/components/page-view-tracker";

const openSauce = localFont({
  variable: "--font-open-sauce",
  display: "swap",
  src: [
    { path: "../fonts/OpenSauceSans-Regular.woff", weight: "400", style: "normal" },
    { path: "../fonts/OpenSauceSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/OpenSauceSans-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/OpenSauceSans-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const peaceSans = localFont({
  variable: "--font-peace",
  display: "swap",
  src: [{ path: "../fonts/PeaceSans.otf", weight: "400", style: "normal" }],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://sneakersterminal.com"),
  title: "Sneakers Terminal",
  description: "The prediction market terminal for college students and recent grads.",
  openGraph: {
    title: "Sneakers Terminal",
    description: "The prediction market terminal for college students and recent grads.",
    url: "https://sneakersterminal.com",
    siteName: "Sneakers Terminal",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sneakers Terminal",
    description: "The prediction market terminal for college students and recent grads.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The marketing footer (social icons, "Student discount", apex links,
  // legal disclaimer) doesn't belong on the admin or app subdomains —
  // those are operator/user surfaces, not the public landing. Suppress
  // the footer for any host other than the apex / www / vercel preview.
  const hdrs = await headers();
  const host = (hdrs.get("host") ?? "").toLowerCase();
  const isApex =
    host === "sneakersterminal.com" ||
    host === "www.sneakersterminal.com" ||
    host === "" ||
    host.startsWith("localhost") ||
    host.endsWith(".localhost") ||
    host.endsWith(".vercel.app");
  return (
    <html
      lang="en"
      className={`${openSauce.variable} ${peaceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-stone-900 font-sans">
        {/* PageViewTracker auto-fires `page_view` events on every nav. Wrapped
            in Suspense because useSearchParams() requires it in Next 16.
            Mounts once at the root so every route gets covered. */}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <div className="flex-1">{children}</div>
        {isApex && <Footer />}
      </body>
    </html>
  );
}
