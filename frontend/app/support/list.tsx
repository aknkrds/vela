import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '@/src/api/client';

export default function SupportTicketsList() {
  const { fontSizeScale, t, colors, comfortMode } = useSettings();
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTickets = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      const response = await api.get('/support/tickets');
      setTickets(response.data);
    } catch (err) {
      console.error('Error fetching support tickets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets(false);
  };

  const getStatusColor = (status: string) => {
    return status === 'open' ? colors.success : colors.textMuted;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'open') return t('supportStatusOpen') || 'Açık';
    return t('supportStatusClosed') || 'Kapalı';
  };

  const renderTicketItem = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.status);
    const dateStr = new Date(item.updated_at).toLocaleDateString();

    return (
      <TouchableOpacity
        style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: '/support/detail', params: { id: item.ticket_id } })}
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketIdRow}>
            <Text style={[styles.ticketId, { fontSize: 16 * fontSizeScale, color: colors.accent }]}>
              {item.ticket_id}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
              <Text style={[styles.statusText, { fontSize: 11 * fontSizeScale, color: statusColor }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
          <Text style={[styles.ticketDate, { fontSize: 12 * fontSizeScale, color: colors.textMuted }]}>
            {dateStr}
          </Text>
        </View>

        <Text style={[styles.ticketSubject, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]} numberOfLines={1}>
          {item.subject}
        </Text>
        
        <Text style={[styles.ticketDesc, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.messageCount, { fontSize: 12 * fontSizeScale, color: colors.textMuted }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
            {' '}{item.messages?.length || 0} Mesaj
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
          {t('supportMyTickets') || 'Destek Taleplerim'}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/support/create')}
          style={styles.createButton}
        >
          <Ionicons name="add" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicketItem}
          keyExtractor={(item) => item.ticket_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbox-ellipses-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyText, { fontSize: 16 * fontSizeScale, color: colors.textMuted }]}>
                {t('supportNoTickets') || 'Henüz bir destek talebiniz bulunmuyor.'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
                onPress={() => router.push('/support/create')}
              >
                <Text style={styles.emptyBtnText}>Yeni Destek Talebi Aç</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  createButton: {
    padding: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  ticketCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticketIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketId: {
    fontWeight: '800',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontWeight: 'bold',
  },
  ticketDate: {
    fontWeight: '500',
  },
  ticketSubject: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  ticketDesc: {
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  messageCount: {
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
