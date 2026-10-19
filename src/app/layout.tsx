import type { Metadata } from 'next';
import { Chakra_Petch, Inter } from 'next/font/google';
import './globals.css';

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Collection — Board Game Shelf',
  description: 'Mobile board game collection and play tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${chakraPetch.variable} ${inter.variable}`}>
      <body className="font-sans bg-[#070913] text-white antialiased">
        {children}
      </body>
    </html>
  );
}