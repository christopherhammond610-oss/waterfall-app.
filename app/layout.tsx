import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Header from "@/components/Header";
import { AppStateProvider } from "@/context/AppStateContext";
import { ToastProvider } from "@/context/ToastContext";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Waterfall | Direct Creator Stream",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <div className="ambient-glow-1"></div>
        <div className="ambient-glow-2"></div>

        <AppStateProvider>
          <ToastProvider>
            <Header />
            <main>{children}</main>
          </ToastProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
