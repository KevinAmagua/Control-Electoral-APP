import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing, typography } from '@/core/theme';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
}>;

type ScreenScrollContextValue = {
  scrollToTop: () => void;
};

const ScreenScrollContext = createContext<ScreenScrollContextValue | null>(null);

export function useScreenScrollToTop() {
  return useContext(ScreenScrollContext)?.scrollToTop;
}

export function Screen({ title, subtitle, action, children }: ScreenProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  }, []);

  return (
    <ScreenScrollContext.Provider value={{ scrollToTop }}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </ScreenScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: palette.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: palette.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
