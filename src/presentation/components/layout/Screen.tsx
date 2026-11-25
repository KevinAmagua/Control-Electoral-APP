import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing, typography } from '@/core/theme';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
}>;

type ScreenScrollContextValue = {
  scrollToTop: () => void;
  scrollToField: (field: ViewInstance | null) => void;
};

const ScreenScrollContext = createContext<ScreenScrollContextValue | null>(null);

export function useScreenScrollToTop() {
  return useContext(ScreenScrollContext)?.scrollToTop;
}

export function useScreenScrollToField() {
  return useContext(ScreenScrollContext)?.scrollToField;
}

export function Screen({ title, subtitle, action, children }: ScreenProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  }, []);
  const scrollToField = useCallback((field: ViewInstance | null) => {
    if (!field || !scrollRef.current) {
      return;
    }
    field.measureLayout(
      scrollRef.current,
      (_x, y) => {
        scrollRef.current?.scrollTo({ x: 0, y: Math.max(0, y - 120), animated: true });
      },
      () => {},
    );
  }, []);
  const scrollContext = useMemo(
    () => ({ scrollToTop, scrollToField }),
    [scrollToField, scrollToTop],
  );

  return (
    <ScreenScrollContext.Provider value={scrollContext}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoiding}
          keyboardVerticalOffset={0}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
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
  keyboardAvoiding: {
    flex: 1,
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
