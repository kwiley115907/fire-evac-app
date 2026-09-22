import { NavBar } from '@/components/NavBar';
import { AuthCard } from '@/components/AuthCard';

export default function SignupPage() {
  return (
    <div className="shell">
      <NavBar />
      <main>
        <AuthCard mode="sign-up" />
      </main>
    </div>
  );
}
