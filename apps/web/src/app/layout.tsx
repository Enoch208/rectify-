import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Rectify — Closed isn’t fixed",
  description:
    "Rectify carries customer issues across Gmail, GitHub and Slack, checks that the customer’s own workflow actually works, and follows through to observed recovery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`antialiased dark ${GeistSans.variable} ${GeistMono.variable} ${manrope.variable}`}
    >
      <body className="min-h-screen selection:bg-accent-500/20 selection:text-accent-100">
        {children}
      </body>
    </html>
  );
}
