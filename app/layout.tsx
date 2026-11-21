import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Golos_Text, Oswald } from "next/font/google";
import "./globals.css";
import { SkipLink } from "../components/client";
import { THEME_COLOR } from "../lib/sections";

const golos = Golos_Text({ subsets: ["cyrillic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-golos", display: "swap" });
const oswald = Oswald({ subsets: ["cyrillic", "latin"], weight: ["500", "600", "700"], variable: "--font-oswald", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Цифровой деканат", template: "%s - Цифровой деканат" },
  description: "Концепт для конкурса - не официальный сервис. Все данные вымышленные.",
  robots: { index: false, follow: false },
};

// viewport-fit=cover: the sky runs under the notch, .ph pads the content by the safe areas
export async function generateViewport(): Promise<Viewport> {
  const night = (await cookies()).get("theme")?.value === "night";
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: night ? THEME_COLOR.night : THEME_COLOR.day,
    colorScheme: night ? "dark" : "light" };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // the theme lives in a cookie and is rendered on the server, so the page never flashes
  const night = (await cookies()).get("theme")?.value === "night";
  return (
    <html lang="ru" className={`${golos.variable} ${oswald.variable}`}>
      <body className={night ? "ph night" : "ph"}>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
