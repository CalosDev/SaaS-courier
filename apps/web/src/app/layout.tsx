import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Courier SaaS Backoffice",
  description: "Backoffice administrativo para empresas de courier",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
