import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ApparelFlow ERP — Cutting & Verification Gate",
    template: "%s · ApparelFlow ERP",
  },
  description:
    "Cutting Operations & Gatekeeper Verification Terminal: server-enforced QC hard stop between the cutting room and the sewing floor.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1426",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster
          theme="light"
          position="top-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: "!border-slate-200 !bg-white !text-slate-900 !shadow-raised",
              description: "!text-slate-600",
            },
          }}
        />
      </body>
    </html>
  );
}
