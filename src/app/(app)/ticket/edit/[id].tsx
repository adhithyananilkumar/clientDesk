import { useLocalSearchParams } from 'expo-router';

import { TicketFormScreen } from '@/features/tickets/screens/ticket-form-screen';

export default function EditTicket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketFormScreen ticketId={id} />;
}
