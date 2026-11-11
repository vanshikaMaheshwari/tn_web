import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import Navbar from '@/components/navbar/navbar';
import Footer from '@/components/footer/footer';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata = {
  title: 'TechNeeds IGDTUW · Upgrade Yourself',
  description: 'Mentor-led cohorts, missions, a live leaderboard and AI learner profiles for the TechNeeds IGDTUW community.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Navbar />
          {children}
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
