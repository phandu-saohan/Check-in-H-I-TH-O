import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Hội Thảo Khoa Học Check-in',
  description: 'Hệ thống điểm danh sinh viên tham dự Hội thảo Khoa học ngày 11/04/2026',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
