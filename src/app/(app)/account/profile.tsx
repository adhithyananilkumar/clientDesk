import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, FormField, Icon, Page, ThemedText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { uploadPublicImage, useMyProfile, useUpdateProfile } from '@/features/workspace';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import type { MyProfile as MyProfileRow } from '@/types/models';
import { errorMessage } from '@/utils/format';
import { profileSchema } from '@/validation';

export default function MyProfileRoute() {
  const profile = useMyProfile().data;
  if (!profile) return <Page back title="My profile">{null}</Page>;
  return <MyProfile profile={profile} />;
}

function MyProfile({ profile }: { profile: MyProfileRow }) {
  const theme = useTheme();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const [name, setName] = useState(profile.full_name);
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) return toast.error('Choose a photo under 5 MB');
    setUploading(true);
    try {
      const url = await uploadPublicImage(`users/${user!.id}`, asset.uri, asset.mimeType ?? 'image/jpeg');
      await update.mutateAsync({ avatar_url: url });
      toast.success('Photo updated');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const parsed = profileSchema.safeParse({ full_name: name });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    try {
      await update.mutateAsync({ full_name: parsed.data.full_name });
      toast.success('Profile saved');
      router.back();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Page back title="My profile" subtitle="This is how teammates see you on tickets and comments." footer={<Button title="Save" onPress={save} loading={update.isPending && !uploading} />}>
      <View style={styles.photoRow}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar size={96} name={name || profile?.email} uri={profile?.avatar_url} />
          <View style={[styles.edit, { backgroundColor: theme.text, borderColor: theme.background }]}>
            <Icon name={uploading ? 'sync' : 'pencil'} size={13} color={theme.background} />
          </View>
        </Pressable>
        <View style={styles.photoText}>
          <ThemedText style={styles.bold}>Profile photo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.regular}>
            Square images work best. JPG, PNG or WEBP up to 5 MB.
          </ThemedText>
          <View style={styles.photoActions}>
            <Button title="Change" size="sm" variant="secondary" onPress={pickPhoto} loading={uploading} />
            {profile?.avatar_url ? (
              <Button title="Remove" size="sm" variant="ghost" onPress={() => update.mutate({ avatar_url: null })} />
            ) : null}
          </View>
        </View>
      </View>

      <FormField label="Full name" value={name} onChangeText={setName} error={error} autoComplete="name" textContentType="name" returnKeyType="done" onSubmitEditing={save} />
    </Page>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center', marginBottom: Spacing.five },
  edit: { position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  photoText: { flex: 1, gap: 4 },
  photoActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },
});
