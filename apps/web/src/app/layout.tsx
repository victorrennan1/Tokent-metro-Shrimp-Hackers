import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokentômetro — telemetria para builders",
  description: "Entenda onde seus tokens estão trabalhando."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

