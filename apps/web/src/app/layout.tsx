import type { Metadata } from 'next';
import './globals.css';
import { PortalThemeProvider } from '@/components/PortalThemeProvider';

export const metadata: Metadata = {
  title: 'LogIt — IT Service Management',
  description: 'Enterprise IT service desk and service management platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PortalThemeProvider>{children}</PortalThemeProvider>
      </body>
    </html>
  );
}
