import { useLocalSearchParams } from 'expo-router';

import { TicketDetailScreen } from '@/features/tickets/screens/ticket-detail-screen';

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketDetailScreen id={id} />;
}
