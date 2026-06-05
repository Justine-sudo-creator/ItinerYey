import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccessBanner } from "@/components/layout/AccessBanner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "ItinerYey",
  description: "A mobile-first web app for trip itineraries",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${plusJakartaSans.variable} font-sans bg-background text-primary`}
      >
        <div className="flex flex-col min-h-screen relative">
          <AppHeader />
          <AccessBanner />
          <div className="flex-1 w-full flex flex-col items-center">
            <PageContainer className="flex-1 flex flex-col w-full">
              {children}
            </PageContainer>
          </div>
        </div>
      </body>
    </html>
  );
}
