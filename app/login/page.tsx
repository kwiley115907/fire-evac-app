import { NavBar } from '@/components/NavBar';
import { AuthCard } from '@/components/AuthCard';
import { BrandBackdrop } from '@/components/Brand';

export default function LoginPage() {
  return (
    <div className="shell">
      <NavBar />
      <BrandBackdrop>
        <AuthCard mode="sign-in" />
      </BrandBackdrop>
    </div>
  );
}
