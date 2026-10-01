import { NavBar } from '@/components/NavBar';
import { AuthCard } from '@/components/AuthCard';
import { BrandBackdrop } from '@/components/Brand';

export default function SignupPage() {
  return (
    <div className="shell">
      <NavBar />
      <BrandBackdrop>
        <AuthCard mode="sign-up" />
      </BrandBackdrop>
    </div>
  );
}
