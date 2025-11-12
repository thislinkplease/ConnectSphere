import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';

export default function PaymentProScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const [processing, setProcessing] = useState(false);

  const isPro = user?.isPro || false;

  const handleSubscribe = async () => {
    if (!user?.username) return;

    Alert.alert(
      'Confirm Subscription',
      'Subscribe to Pro for $9.99/month (Test Mode)?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Subscribe',
          onPress: async () => {
            try {
              setProcessing(true);
              // Call API to activate Pro subscription
              if (user?.username) {
                await ApiService.activateProSubscription(user.username);
                
                // Refresh user data from server to get updated isPro status
                await refreshUser();
              }
              
              Alert.alert(
                'Success!',
                'You are now a Pro member! Enjoy your exclusive features.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error subscribing:', error);
              Alert.alert('Error', 'Failed to process subscription. Please try again.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelSubscription = async () => {
    if (!user?.username) return;

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your Pro subscription?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              // Call API to deactivate Pro subscription
              if (user?.username) {
                await ApiService.deactivateProSubscription(user.username);
                
                // Refresh user data from server to get updated isPro status
                await refreshUser();
              }
              
              Alert.alert('Subscription Cancelled', 'Your Pro subscription has been cancelled.');
            } catch (error) {
              console.error('Error cancelling subscription:', error);
              Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Pro Features',
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView>
          {/* Pro Status */}
          <View style={[styles.statusCard, isPro && styles.statusCardPro]}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name={isPro ? 'star' : 'star-outline'} 
                size={32} 
                color={isPro ? '#FFD700' : '#666'} 
              />
              <Text style={styles.statusTitle}>
                {isPro ? 'Pro Member' : 'Free Member'}
              </Text>
            </View>
            {isPro && (
              <Text style={styles.statusSubtitle}>
                Thank you for being a Pro member!
              </Text>
            )}
          </View>

          {/* Pro Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pro Features</Text>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Extended Friend Limit</Text>
                <Text style={styles.featureDescription}>
                  Follow up to 512 people (vs. 16 for free members)
                </Text>
              </View>
              {isPro && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="sparkles" size={24} color={colors.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>AI Post Writer</Text>
                <Text style={styles.featureDescription}>
                  Use AI to help write engaging posts (Coming Soon)
                </Text>
              </View>
              {isPro && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="color-palette" size={24} color={colors.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Exclusive Theme</Text>
                <Text style={styles.featureDescription}>
                  Beautiful yellow & white color scheme for Pro members
                </Text>
              </View>
              {isPro && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="flash" size={24} color={colors.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Priority Support</Text>
                <Text style={styles.featureDescription}>
                  Get faster response from our support team
                </Text>
              </View>
              {isPro && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <View style={styles.pricingCard}>
              <Text style={[styles.pricingAmount, { color: colors.primary }]}>$9.99</Text>
              <Text style={styles.pricingPeriod}>per month</Text>
              <Text style={styles.pricingNote}>
                🧪 Test Mode - No real payment required
              </Text>
              <Text style={[styles.pricingNote, { marginTop: 8 }]}>
                You can cancel anytime
              </Text>
            </View>
          </View>



          {/* Action Button */}
          {!isPro ? (
            <TouchableOpacity 
              style={[styles.subscribeButton, { backgroundColor: colors.primary }, processing && styles.subscribeButtonDisabled]}
              onPress={handleSubscribe}
              disabled={processing}
            >
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.subscribeButtonText}>
                {processing ? 'Processing...' : 'Subscribe to Pro (Test Mode)'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.cancelButton, processing && styles.cancelButtonDisabled]}
              onPress={handleCancelSubscription}
              disabled={processing}
            >
              <Text style={styles.cancelButtonText}>
                {processing ? 'Processing...' : 'Cancel Subscription'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.footer} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  statusCardPro: {
    borderColor: '#FFD700',
    backgroundColor: '#FFFBF0',
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  pricingCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  pricingAmount: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  pricingPeriod: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  pricingNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  testInstructions: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  subscribeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelButtonDisabled: {
    borderColor: '#ccc',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  footer: {
    height: 40,
  },
});
