import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, Animated } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { Card } from '../../src/components/Card';
import { dataService, Announcement } from '../../src/services/dataService';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonCard } from '../../src/components/SkeletonLoader';
import { useTheme } from '../../src/context/ThemeContext';
import { AnnouncementPopup } from '../../src/components/AnnouncementPopup';
import { Button } from '../../src/components/Button';
import * as Haptics from 'expo-haptics';
import { getUnreadAnnouncements, markAnnouncementsAsRead } from '../../src/services/notificationService';
import { useRBAC } from '../../src/hooks/useRBAC';

export default function Dashboard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme: themeMode } = useTheme();
  const theme = Colors[themeMode];
  const { role } = useRBAC();

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-10)).current;
  const statsAnims = [
    { opacity: useRef(new Animated.Value(0)).current, scale: useRef(new Animated.Value(0.9)).current },
    { opacity: useRef(new Animated.Value(0)).current, scale: useRef(new Animated.Value(0.9)).current },
    { opacity: useRef(new Animated.Value(0)).current, scale: useRef(new Animated.Value(0.9)).current },
  ];

  // Stats
  const [stats, setStats] = useState({ orders: 0, stockItems: 0, pending: 0 });

  useEffect(() => {
    // Animate header
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(headerTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    // Animate stats with delays
    statsAnims.forEach((anim, index) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(anim.opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.spring(anim.scale, { toValue: 1, friction: 8, useNativeDriver: true }),
        ]).start();
      }, 100 + index * 100);
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [announcementsData, ordersResponse, stockResponse] = await Promise.all([
        dataService.getAnnouncements(),
        dataService.getOrders().catch(() => ({ data: [], pagination: null })),
        dataService.getStock().catch(() => ({ data: [], pagination: null })),
      ]);

      setAnnouncements(announcementsData || []);

      // Get unread announcements
      const unread = await getUnreadAnnouncements<Announcement>(announcementsData || []);
      setUnreadAnnouncements(unread);

      // Handle paginated or raw responses
      const ordersData = ordersResponse.data || ordersResponse || [];
      const stockData = stockResponse.data || stockResponse || [];

      // Calculate stats
      const ordersArray = Array.isArray(ordersData) ? ordersData : [];
      const pendingOrders = ordersArray.filter((o: any) => o.status === 'pending').length;

      // For total counts, if we have pagination metadata, use that for accuracy!
      const finalTotalOrders = ordersResponse.pagination?.total ?? ordersArray.length;
      const finalTotalStock = stockResponse.pagination?.total ?? (Array.isArray(stockData) ? stockData.length : 0);

      setStats({ orders: finalTotalOrders, stockItems: finalTotalStock, pending: pendingOrders });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Track if popup has been shown this session
  const hasShownPopup = React.useRef(false);

  // Show popup when unread announcements are loaded for first time
  useEffect(() => {
    if (!isInitialLoad && !loading && unreadAnnouncements.length > 0 && !hasShownPopup.current) {
      hasShownPopup.current = true;
      const timer = setTimeout(() => setShowPopup(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad, loading, unreadAnnouncements.length]);

  const handlePopupDismiss = useCallback(async () => {
    setShowPopup(false);
    const ids = unreadAnnouncements.map(a => a._id);
    await markAnnouncementsAsRead(ids);
    setUnreadAnnouncements([]);
  }, [unreadAnnouncements]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dataService.invalidateCache('announcements');
    fetchData();
  }, [fetchData]);

  const handleCreateAnnouncement = useCallback(async () => {
    if (!newTitle.trim() || !newMessage.trim()) {
      Alert.alert('Error', 'Please enter both title and message');
      return;
    }

    try {
      setIsSubmitting(true);
      await dataService.createAnnouncement({
        title: newTitle.trim(),
        message: newMessage.trim()
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Announcement posted!');
      setShowCreateModal(false);
      setNewTitle('');
      setNewMessage('');
      fetchData();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to post announcement');
    } finally {
      setIsSubmitting(false);
    }
  }, [newTitle, newMessage, fetchData]);

  const SkeletonList = useMemo(() => (
    <View>
      {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
    </View>
  ), []);

  const renderAnnouncement = useCallback((item: Announcement, index: number) => {
    const createdDate = new Date(item.createdAt);
    const expiryDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    return (
      <Card key={item._id} delay={index * 100}>
        <View style={styles.announcementHeader}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="megaphone" size={16} color={theme.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
              {role === 'super_admin' && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Delete Announcement', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete', style: 'destructive', onPress: async () => {
                          try {
                            await dataService.deleteAnnouncement(item._id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setAnnouncements(prev => prev.filter(a => a._id !== item._id));
                          } catch (e) {
                            Alert.alert("Error", "Failed to delete");
                          }
                        }
                      }
                    ]);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.error} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.date, { color: theme.textSecondary }]}>
              {new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
              })}
              {daysRemaining > 0 && (
                <Text style={{ color: daysRemaining <= 2 ? theme.error : theme.textSecondary }}>
                  {' '}• {daysRemaining}d left
                </Text>
              )}
            </Text>
          </View>
        </View>
        <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{item.message}</Text>
      </Card>
    );
  }, [theme, role]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        <Animated.View
          style={[
            styles.header,
            { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }
          ]}
        >
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>Hello, Staff</Text>
            <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
          </View>
        </Animated.View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Animated.View
            style={[
              styles.statCard,
              { backgroundColor: theme.primary + '15', opacity: statsAnims[0].opacity, transform: [{ scale: statsAnims[0].scale }] }
            ]}
          >
            <Ionicons name="receipt-outline" size={24} color={theme.primary} />
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.orders}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Orders</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              { backgroundColor: theme.success + '15', opacity: statsAnims[1].opacity, transform: [{ scale: statsAnims[1].scale }] }
            ]}
          >
            <Ionicons name="cube-outline" size={24} color={theme.success} />
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.stockItems}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Stock Items</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              { backgroundColor: theme.error + '15', opacity: statsAnims[2].opacity, transform: [{ scale: statsAnims[2].scale }] }
            ]}
          >
            <Ionicons name="time-outline" size={24} color={theme.error} />
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.pending}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
          </Animated.View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Announcements</Text>
          <View style={[styles.countBadge, { backgroundColor: theme.primary + '20' }]}>
            <Text style={[styles.countText, { color: theme.primary }]}>{announcements.length}</Text>
          </View>
        </View>

        {isInitialLoad ? SkeletonList : (
          (!announcements || announcements.length === 0) ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No announcements yet</Text>
            </View>
          ) : (
            announcements.map((item, index) => renderAnnouncement(item, index))
          )
        )}
      </ScrollView>

      {/* FAB to create announcement */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowCreateModal(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Announcement Popup */}
      {showPopup && unreadAnnouncements.length > 0 && (
        <AnnouncementPopup
          announcements={unreadAnnouncements}
          onDismiss={handlePopupDismiss}
        />
      )}

      {/* Create Announcement Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>New Announcement</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Visible to all users for 7 days
            </Text>

            <TextInput
              style={[styles.input, {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border
              }]}
              placeholder="Title"
              placeholderTextColor={theme.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={100}
            />

            <TextInput
              style={[styles.input, styles.messageInput, {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border
              }]}
              placeholder="Message"
              placeholderTextColor={theme.textSecondary}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            <View style={[styles.modalActions, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.border }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleCreateAnnouncement}
                disabled={isSubmitting}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {isSubmitting ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 16, fontWeight: '500' },
  title: { fontSize: 32, fontWeight: 'bold' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: { fontSize: 12, fontWeight: 'bold' },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  date: { fontSize: 11, marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  emptyState: { alignItems: 'center', padding: 40 },
  fab: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  modalSubtitle: { fontSize: 12, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  messageInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
});
