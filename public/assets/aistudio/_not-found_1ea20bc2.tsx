import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { LocalizedText as Text, translateText, useAppLanguage } from '@/lib/i18n';

export default function NotFoundScreen() {
  const colors = useColors();
  const { language } = useAppLanguage();

  return (
    <>
      <Stack.Screen options={{ title: translateText('Oops!', language) }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          This screen doesn&apos;t exist.
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
