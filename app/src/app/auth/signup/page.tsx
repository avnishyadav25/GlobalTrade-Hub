import { redirect } from 'next/navigation';

// Single super-admin mode — self-service signup is disabled.
export default function SignupPage() {
    redirect('/auth/login');
}
