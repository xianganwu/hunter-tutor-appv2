import type { Metadata } from "next";
import localFont from "next/font/local";
import { TopNav } from "@/components/shared/TopNav";
import { ProgressHydrator } from "@/components/shared/ProgressHydrator";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Hunter Tutor — Build Your Path to Hunter College High School",
  description:
    "An adaptive tutoring app that helps rising 5th and 6th graders build foundational skills and prepare for the Hunter College High School entrance exam through Socratic learning, practice exams, and personalized coaching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('hunter-tutor-theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <TopNav />
        <ProgressHydrator>{children}</ProgressHydrator>
      </body>
    </html>
  );
}
