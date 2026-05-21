import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'КлассМаркет — Живые онлайн-классы для детей',
  description:
    'Маркетплейс живых онлайн-классов для детей от 3 до 18 лет. Найдите лучших преподавателей и запишите ребёнка на занятия.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
