import type { Metadata } from 'next';
import { NavBar } from '@/components/NavBar';
import { ForgotPasswordCard } from '@/components/PasswordReset';
import { BrandBackdrop } from '@/components/Brand';

export const metadata: Metadata = {
  title: 'Forgot password — Sentinel Grid',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="shell">
      <NavBar />
      <BrandBackdrop>
        <ForgotPasswordCard />
      </BrandBackdrop>
    </div>
  );
}
