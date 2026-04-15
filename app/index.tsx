import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteSermon, listSermons } from '@/storage/sermons';
import type { Sermon } from '@/types';
import { formatDate, formatElapsed } from '@/util/format';

export default function HomeScreen() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const router = useRouter();

  const refresh = useCallback(async () => {
    const items = await listSermons();
    setSermons(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onDelete = (s: Sermon) => {
    Alert.alert('Delete sermon?', s.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSermon(s.id);
          await refresh();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={sermons}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No sermons yet</Text>
            <Text style={styles.emptySub}>
              Tap “New Sermon” below to record your first one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/sermon/${item.id}`)}
            onLongPress={() => onDelete(item)}
          >
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardMeta}>
              {formatDate(item.createdAt)} • {formatElapsed(item.durationMs)} •{' '}
              {item.outline.points.length} points
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Link href="/settings" asChild>
          <TouchableOpacity style={styles.secondary}>
            <Text style={styles.secondaryText}>Settings</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/record" asChild>
          <TouchableOpacity style={styles.primary}>
            <Text style={styles.primaryText}>+ New Sermon</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  list: { padding: 16, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#475569', marginBottom: 8 },
  emptySub: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  cardMeta: { fontSize: 13, color: '#64748b' },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  primary: {
    flex: 2,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#334155', fontWeight: '600', fontSize: 16 },
});
