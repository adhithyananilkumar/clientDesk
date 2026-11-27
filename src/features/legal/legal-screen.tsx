import { StyleSheet, View } from 'react-native';

import { Page, ThemedText } from '@/components/ui';
import { Spacing } from '@/constants/theme';

import { LEGAL_UPDATED, type LegalDoc } from './content';

/** Readable long-form text; works signed in or out. */
export function LegalScreen({ doc }: { doc: LegalDoc }) {
  return (
    <Page back title={doc.title} subtitle={`Last updated ${LEGAL_UPDATED}`}>
      <ThemedText themeColor="textSecondary">{doc.intro}</ThemedText>
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <ThemedText accessibilityRole="header" style={styles.heading}>
            {section.heading}
          </ThemedText>
          {section.body.map((paragraph) => (
            <ThemedText key={paragraph} type="small" style={styles.paragraph}>
              {paragraph}
            </ThemedText>
          ))}
        </View>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, marginTop: Spacing.three },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  paragraph: { lineHeight: 21 },
});
