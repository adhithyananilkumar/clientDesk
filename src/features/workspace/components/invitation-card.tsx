import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Pill, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Spacing } from '@/constants/theme';
import { toast } from '@/stores/toast-store';
import type { MyInvitation } from '@/types/models';
import { errorMessage, shortDate } from '@/utils/format';

import { useRespondToInvitation } from '../api';

export function InvitationCard({ invitation, onJoined }: { invitation: MyInvitation; onJoined?: () => void }) {
  const respond = useRespondToInvitation();
  const busy = respond.isPending ? respond.variables?.accept : undefined;

  const answer = (accept: boolean) =>
    respond.mutate(
      { id: invitation.id, accept },
      {
        onSuccess: () => {
          toast.success(accept ? `You joined ${invitation.workspace_name}` : 'Invitation declined');
          if (accept) onJoined?.();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Avatar name={invitation.workspace_name} uri={invitation.workspace_logo_url} size={44} square />
        <View style={styles.text}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {invitation.workspace_name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
            {invitation.invited_by_name} invited you · expires {shortDate(invitation.expires_at)}
          </ThemedText>
        </View>
        <Pill label={ROLE[invitation.role].label} tone={ROLE[invitation.role].tone} small />
      </View>
      <View style={styles.actions}>
        <Button title="Decline" variant="secondary" size="md" style={styles.flex} onPress={() => answer(false)} loading={busy === false} disabled={respond.isPending} />
        <Button title="Join" size="md" style={styles.flex} onPress={() => answer(true)} loading={busy === true} disabled={respond.isPending} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700' },
  meta: { fontWeight: '400' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
