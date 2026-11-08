import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Strategiýa 2052 · Высшее образование', description: 'Управление стратегией высшего образования Туркменистана 2026–2052', icons: { icon: '/favicon.svg' } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ru"><body>{children}</body></html>; }
