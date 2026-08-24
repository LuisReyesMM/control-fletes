import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control de Fletes",
  description: "Sistema administrativo para control y seguimiento de fletes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
