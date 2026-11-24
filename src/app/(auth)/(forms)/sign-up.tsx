import { AuthFlow } from '@/features/auth';

/** Deep link straight into the form. Same screen as welcome, so switching never navigates. */
export default function SignUp() {
  return <AuthFlow initial="sign-up" />;
}
