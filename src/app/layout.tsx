import type React from "react";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Train Data Website",
  description: "A website displaying train data from a Neon database",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Header />

        <div>{children}</div>
        {/* <footer className="bg-muted py-4 text-center text-sm">
          <div className="container mx-auto">
            &copy; {new Date().getFullYear()} Train Data Website
          </div>
        </footer> */}
      </body>
    </html>
  );
}
