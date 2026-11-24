import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, OptionSheet, ThemedText } from '@/components/ui';
import { UPLOAD } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import type { Attachment } from '@/types/models';
import { fileSize } from '@/utils/format';

import { useSignedUrl, validateFile, type PickedFile } from '../api';

const DOC_TYPES = Object.keys(UPLOAD.mimeTypes).filter((m) => !m.startsWith('image/'));

function guessMime(name: string, given?: string | null) {
  if (given && UPLOAD.mimeTypes[given]) return given;
  const ext = name.split('.').pop()?.toLowerCase();
  const entry = Object.entries(UPLOAD.mimeTypes).find(([, e]) => e === ext || (ext === 'jpeg' && e === 'jpg'));
  return entry?.[0] ?? given ?? 'application/octet-stream';
}

/** Photos or documents → validated PickedFile[]; shows why anything was rejected. */
export function useAttachmentPicker(current: number, onPicked: (files: PickedFile[]) => void) {
  const [open, setOpen] = useState(false);
  const room = UPLOAD.maxPerBatch - current;

  const accept = (files: PickedFile[]) => {
    const ok: PickedFile[] = [];
    const problems: string[] = [];
    for (const f of files.slice(0, room)) {
      const problem = validateFile(f);
      if (problem) problems.push(problem);
      else ok.push(f);
    }
    if (files.length > room) problems.push(`Up to ${UPLOAD.maxPerBatch} files at a time`);
    if (problems.length) toast.error(problems[0]);
    if (ok.length) onPicked(ok);
  };

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.8,
    });
    if (result.canceled) return;
    accept(
      result.assets.map((a, i) => {
        const name = a.fileName ?? `photo-${Date.now()}-${i}.jpg`;
        return { uri: a.uri, name, mimeType: guessMime(name, a.mimeType ?? 'image/jpeg'), size: a.fileSize ?? 1 };
      }),
    );
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return toast.error('Allow camera access in Settings to take a photo.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const a = result.assets[0];
    accept([{ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? 1 }]);
  };

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: [...DOC_TYPES, 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    accept(result.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: guessMime(a.name, a.mimeType), size: a.size ?? 1 })));
  };

  const sheet = (
    <OptionSheet
      visible={open}
      onClose={() => setOpen(false)}
      title="Attach files"
      subtitle="Images, PDF, Word, Excel or text · up to 10 MB each"
      options={[
        { value: 'photos', label: 'Photo library', icon: 'image' },
        { value: 'camera', label: 'Take a photo', icon: 'device-camera' },
        { value: 'files', label: 'Browse files', icon: 'file' },
      ]}
      onSelect={(choice) => {
        setTimeout(() => (choice === 'photos' ? pickPhotos() : choice === 'camera' ? takePhoto() : pickDocuments()), 250);
      }}
    />
  );

  return {
    open: () => (room > 0 ? setOpen(true) : toast.error(`Up to ${UPLOAD.maxPerBatch} files at a time`)),
    sheet,
  };
}

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return 'file-media' as const;
  if (mime === 'application/pdf') return 'file' as const;
  if (mime.includes('spreadsheet')) return 'table' as const;
  return 'file' as const;
}

/** Chips for files chosen but not yet uploaded. */
export function PendingFiles({ files, onRemove }: { files: PickedFile[]; onRemove: (index: number) => void }) {
  const theme = useTheme();
  if (!files.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pending}>
      {files.map((f, i) => (
        <View key={`${f.uri}-${i}`} style={[styles.pendingChip, { backgroundColor: theme.backgroundElement }]}>
          {f.mimeType.startsWith('image/') ? (
            <Image source={{ uri: f.uri }} style={styles.pendingThumb} contentFit="cover" />
          ) : (
            <Icon name={iconFor(f.mimeType)} size={16} tone="textSecondary" />
          )}
          <View style={styles.pendingText}>
            <ThemedText style={styles.pendingName} numberOfLines={1}>
              {f.name}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {fileSize(f.size)}
            </ThemedText>
          </View>
          <Pressable onPress={() => onRemove(i)} hitSlop={10} accessibilityLabel={`Remove ${f.name}`}>
            <Icon name="x" size={14} tone="textSecondary" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/** Uploaded attachment: image thumbnail or file card. Opens via a short-lived signed URL. */
export function AttachmentTile({ attachment, onDelete }: { attachment: Attachment; onDelete?: () => void }) {
  const theme = useTheme();
  const isImage = attachment.mime_type.startsWith('image/');
  const url = useSignedUrl(attachment.storage_path).data;

  const open = () => {
    if (url) WebBrowser.openBrowserAsync(url).catch(() => toast.error('Couldn’t open the file'));
  };
  const longPress = onDelete
    ? () =>
        Alert.alert('Delete attachment?', attachment.file_name, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ])
    : undefined;

  if (isImage) {
    return (
      <Pressable onPress={open} onLongPress={longPress} accessibilityRole="imagebutton" accessibilityLabel={`Open ${attachment.file_name}`} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
        {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={open}
      onLongPress={longPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${attachment.file_name}`}
      style={({ pressed }) => [styles.file, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.surface }]}>
      <View style={[styles.fileIcon, { backgroundColor: theme.backgroundElement }]}>
        <Icon name={iconFor(attachment.mime_type)} size={16} />
      </View>
      <View style={styles.fileText}>
        <ThemedText style={styles.fileName} numberOfLines={1}>
          {attachment.file_name}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {fileSize(attachment.size_bytes)}
        </ThemedText>
      </View>
      <Icon name="link-external" size={14} tone="textTertiary" />
    </Pressable>
  );
}

export function AttachmentGrid({ attachments, canDelete, onDelete }: { attachments: Attachment[]; canDelete: (a: Attachment) => boolean; onDelete: (a: Attachment) => void }) {
  const images = attachments.filter((a) => a.mime_type.startsWith('image/'));
  const files = attachments.filter((a) => !a.mime_type.startsWith('image/'));
  return (
    <View style={styles.grid}>
      {images.length ? (
        <View style={styles.thumbs}>
          {images.map((a) => (
            <AttachmentTile key={a.id} attachment={a} onDelete={canDelete(a) ? () => onDelete(a) : undefined} />
          ))}
        </View>
      ) : null}
      {files.map((a) => (
        <AttachmentTile key={a.id} attachment={a} onDelete={canDelete(a) ? () => onDelete(a) : undefined} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pending: { gap: Spacing.two, paddingVertical: Spacing.one },
  pendingChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.md, padding: 8, paddingRight: 12, maxWidth: 220 },
  pendingThumb: { width: 32, height: 32, borderRadius: 6 },
  pendingText: { flexShrink: 1 },
  pendingName: { fontSize: 13, fontWeight: '600' },
  grid: { gap: Spacing.two },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumb: { width: 92, height: 92, borderRadius: Radius.md, overflow: 'hidden' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, padding: 10 },
  fileIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  fileText: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600' },
});
