import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  // These are orphaned — no component uses them
  legacyCard: {
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    padding: 12,
  },
  deprecatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
