import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  useStripe, 
  CardField, 
  isPlatformPaySupported,
  PlatformPayButton,
  PlatformPay,
  confirmPlatformPayPayment,
} from '@stripe/stripe-react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';

export default function PaymentProScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { confirmPayment } = useStripe();
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [platformPayReady, setPlatformPayReady] = useState(false);

  const isPro = user?.isPro || false;

  // Check if Apple Pay / Google Pay is available
  React.useEffect(() => {
    (async () => {
      const isSupported = await isPlatformPaySupported();
      setPlatformPayReady(isSupported);
    })();
  }, []);

  /**
   * Handle Apple Pay / Google Pay payment
   */
  const handlePlatformPayPayment = async () => {
    if (!user?.username) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setProcessing(true);

      // Step 1: Create payment intent on server
      const { clientSecret, paymentIntentId } = await ApiService.createPaymentIntent(
        user.username,
        1 // $0.01 USD (test price)
      );

      // Step 2: Confirm platform pay payment (Apple Pay / Google Pay)
      const { error } = await confirmPlatformPayPayment(clientSecret, {
        applePay: {
          cartItems: [
            {
              label: 'Pro Subscription',
              amount: '0.01',
              paymentType: PlatformPay.PaymentType.Immediate,
            },
          ],
          merchantCountryCode: 'US',
          currencyCode: 'USD',
          requiredShippingAddressFields: [],
          requiredBillingContactFields: [],
        },
        googlePay: {
          testEnv: true,
          merchantName: 'ConnectSphere',
          merchantCountryCode: 'US',
          currencyCode: 'USD',
          billingAddressConfig: {
            format: PlatformPay.BillingAddressFormat.Min,
            isPhoneNumberRequired: false,
            isRequired: false,
          },
        },
      });

      if (error) {
        console.error('Platform Pay error:', error);
        Alert.alert('Payment Failed', error.message || 'Failed to process payment');
        setProcessing(false);
        return;
      }

      // Step 3: Activate Pro subscription on server
      await ApiService.activateProSubscription(user.username, paymentIntentId);

      // Step 4: Refresh user data
      await refreshUser();

      Alert.alert(
        'Success!',
        'Payment successful! You are now a Pro member. Enjoy your exclusive features.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error processing platform pay:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleStripePayment = async () => {
    if (!user?.username || !cardComplete) {
      Alert.alert('Error', 'Please complete your card details');
      return;
    }

    try {
      setProcessing(true);
      
      // Step 1: Create payment intent on server
      const { clientSecret, paymentIntentId } = await ApiService.createPaymentIntent(
        user.username,
        1 // $0.01 USD (1 cent, closest to $0.001 as Stripe minimum is $0.50)
      );

      // Step 2: Confirm payment with Stripe
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        console.error('Payment confirmation error:', error);
        Alert.alert('Payment Failed', error.message || 'Failed to process payment');
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'Succeeded') {
        // Step 3: Activate Pro subscription on server
        await ApiService.activateProSubscription(user.username, paymentIntentId);
        
        // Step 4: Refresh user data
        await refreshUser();
        
        Alert.alert(
          'Success!',
          'Payment successful! You are now a Pro member. Enjoy your exclusive features.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Payment Failed', 'Payment was not successful. Please try again.');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleTestModeSubscribe = async () => {
    if (!user?.username) return;

    Alert.alert(
      'Confirm Subscription',
      'Subscribe to Pro for $0.01 (Test Mode)?',
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
              // Call API to activate Pro subscription without Stripe
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
              <Text style={[styles.pricingAmount, { color: colors.primary }]}>$0.01</Text>
              <Text style={styles.pricingPeriod}>per month (test price)</Text>
              <Text style={styles.pricingNote}>
                Test Mode - Using Stripe test payment
              </Text>
              <Text style={[styles.pricingNote, { marginTop: 4 }]}>
                Test card: 4242 4242 4242 4242 (exp: any future date, cvc: any 3 digits)
              </Text>
              <Text style={[styles.pricingNote, { marginTop: 4 }]}>
                You can cancel anytime
              </Text>
            </View>
          </View>

          {/* Payment Method Section (only show if not Pro) */}
          {!isPro && (
            <>
              {/* Platform Pay (Apple Pay / Google Pay) */}
              {platformPayReady && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay'}
                  </Text>
                  <Text style={styles.sectionDescription}>
                    Quick and secure payment with {Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay'}
                  </Text>
                  <PlatformPayButton
                    onPress={handlePlatformPayPayment}
                    type={PlatformPay.ButtonType.Subscribe}
                    appearance={PlatformPay.ButtonStyle.Black}
                    borderRadius={12}
                    style={styles.platformPayButton}
                    disabled={processing}
                  />
                  <Text style={styles.orDivider}>OR</Text>
                </View>
              )}

              {/* Card Payment */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pay with Card</Text>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{
                    number: '4242 4242 4242 4242',
                  }}
                  cardStyle={{
                    backgroundColor: '#FFFFFF',
                    textColor: '#000000',
                  }}
                  style={styles.cardField}
                  onCardChange={(cardDetails) => {
                    setCardComplete(cardDetails.complete);
                  }}
                />
            
                
                <TouchableOpacity 
                  style={[
                    styles.subscribeButton, 
                    { backgroundColor: colors.primary }, 
                    (processing || !cardComplete) && styles.subscribeButtonDisabled
                  ]}
                  onPress={handleStripePayment}
                  disabled={processing || !cardComplete}
                >
                  <Ionicons name="card" size={20} color="#fff" />
                  <Text style={styles.subscribeButtonText}>
                    {processing ? 'Processing...' : 'Pay with Card'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Cancel Subscription (if Pro) */}
          {isPro && (
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
  cardField: {
    height: 50,
    marginVertical: 16,
  },
  cardHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  platformPayButton: {
    height: 50,
    marginVertical: 8,
  },
  orDivider: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginVertical: 16,
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
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 8,
  },
  testButtonDisabled: {
    borderColor: '#ccc',
    opacity: 0.5,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
