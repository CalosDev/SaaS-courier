import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Courier SaaS",
  description: "Plataforma SaaS para empresas de courier",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
