import { TERMS } from '@/features/legal/content';
import { LegalScreen } from '@/features/legal/legal-screen';

export default function Terms() {
  return <LegalScreen doc={TERMS} />;
}
