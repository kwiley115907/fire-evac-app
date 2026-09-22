import { NavBar } from '@/components/NavBar';
import { AuthCard } from '@/components/AuthCard';

export default function LoginPage() {
  return (
    <div className="shell">
      <NavBar />
      <main>
        <AuthCard mode="sign-in" />
      </main>
    </div>
  );
}
