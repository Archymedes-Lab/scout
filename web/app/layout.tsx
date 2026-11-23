import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Scout's type: IBM Plex Sans for everything, Plex Mono for indices and figures. A survey instrument's voice (Jev 0.75).
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Scout", template: "%s · Scout" },
  description: "Where Argus-1 will find its users: platforms, websites and forums, triaged by Orion, planned by cdm.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <a href="#main" className="fixed left-4 -top-16 z-[90] rounded-pill bg-signal px-4 py-2 text-on-signal focus-visible:top-4">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
