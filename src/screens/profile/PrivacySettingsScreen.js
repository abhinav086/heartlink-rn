// PrivacySettingsScreen.js
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const PrivacySettingsScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header with Back Button */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Privacy Policy</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Privacy Policy Content */}
          <View style={styles.policyContainer}>
            <Text style={styles.sectionTitle}>1. Introduction</Text>
            <Text style={styles.paragraph}>
              AI Heartlink FZE LLC (“Company”, “we”, “our”, or “us”) values your trust and is committed to protecting your personal information. This Privacy Policy outlines the collection, use, storage, and disclosure of your data in connection with your use of the AI Heartlink mobile application (“App”).
            </Text>
            <Text style={styles.paragraph}>
              By accessing or using the App, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with our policies and practices, please do not use the App.
            </Text>

            <Text style={styles.sectionTitle}>2. Information We Collect</Text>
            <Text style={styles.subSectionTitle}>A. Personal Information</Text>
            <Text style={styles.paragraph}>Full Name</Text>
            <Text style={styles.paragraph}>Gender and Age</Text>
            <Text style={styles.paragraph}>Profile Picture</Text>
            <Text style={styles.paragraph}>Mobile Phone Number</Text>
            <Text style={styles.paragraph}>Location Data (if you permit access)</Text>

            <Text style={styles.subSectionTitle}>B. Device & Technical Information</Text>
            <Text style={styles.paragraph}>Device Type and OS Version</Text>
            <Text style={styles.paragraph}>Device Identifier and IP Address</Text>
            <Text style={styles.paragraph}>App Version and Interaction Logs</Text>

            <Text style={styles.subSectionTitle}>C. Usage Information</Text>
            <Text style={styles.paragraph}>User preferences and in-app behavior</Text>
            <Text style={styles.paragraph}>Login timestamps</Text>
            <Text style={styles.paragraph}>Profile interactions (e.g., likes, chat initiation)</Text>

            <Text style={styles.sectionTitle}>3. Purpose of Data Collection</Text>
            <Text style={styles.paragraph}>Your data is processed solely to ensure lawful and legitimate app operations. Key purposes include:</Text>
            <Text style={styles.paragraph}>Account creation and secure login</Text>
            <Text style={styles.paragraph}>Tailored matchmaking suggestions and user experience</Text>
            <Text style={styles.paragraph}>Fraud prevention, abuse detection, and security compliance</Text>
            <Text style={styles.paragraph}>Customer support and issue resolution</Text>
            <Text style={styles.paragraph}>Analytics, usage trend monitoring, and feature optimization</Text>
            <Text style={styles.paragraph}>Legal compliance under applicable UAE and international laws</Text>

            <Text style={styles.sectionTitle}>4. Data Sharing & Disclosure</Text>
            <Text style={styles.paragraph}>We do not sell your data to third parties. However, under controlled and lawful scenarios, we may share your data as follows:</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Service Providers:</Text> Trusted partners offering hosting, cloud, analytics, or messaging support (e.g., AWS, Google Firebase)
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Legal Requirements:</Text> To comply with court orders, law enforcement, or UAE government authority directions
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Business Events:</Text> In case of a merger, acquisition, or restructuring, your data may be transferred with due notice
            </Text>
            <Text style={styles.paragraph}>All third parties are contractually bound to safeguard your data in accordance with this Policy.</Text>

            <Text style={styles.sectionTitle}>5. Data Retention & Deletion</Text>
            <Text style={styles.paragraph}>We retain personal data based on the nature of your interaction:</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Active Accounts:</Text> Retained during the lifetime of the account
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Inactive Users:</Text> Accounts inactive for extended periods may be subject to deletion
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Deletion Requests:</Text> Users may initiate deletion through the app or by contacting us. Data will be securely removed within 7 working days upon verification
            </Text>

            <Text style={styles.sectionTitle}>6. Your Data Rights</Text>
            <Text style={styles.paragraph}>As a user, you are entitled to exercise the following rights:</Text>
            <Text style={styles.paragraph}>Right to Access your personal data</Text>
            <Text style={styles.paragraph}>Right to Rectify incorrect or outdated information</Text>
            <Text style={styles.paragraph}>Right to Erasure (“Right to be Forgotten”)</Text>
            <Text style={styles.paragraph}>Right to Withdraw Consent at any time</Text>
            <Text style={styles.paragraph}>Right to Data Portability, if technically feasible</Text>
            <Text style={styles.paragraph}>To invoke any of the above rights, email us at <Text style={styles.link}>support@aiheartlink.com</Text>.</Text>

            <Text style={styles.sectionTitle}>7. Data Security Practices</Text>
            <Text style={styles.paragraph}>We follow recognized security frameworks to protect your data, including:</Text>
            <Text style={styles.paragraph}>End-to-end encryption for sensitive operations</Text>
            <Text style={styles.paragraph}>Token-based access control</Text>
            <Text style={styles.paragraph}>Secure encrypted databases and limited access roles</Text>
            <Text style={styles.paragraph}>Routine penetration testing and vulnerability scans</Text>
            <Text style={styles.paragraph}>While no system is immune from risk, we urge users to use secure devices and report suspicious activities promptly.</Text>

            <Text style={styles.sectionTitle}>8. Children’s Data</Text>
            <Text style={styles.paragraph}>AI Heartlink is strictly for individuals aged 18 and above. We do not knowingly collect information from minors. If we learn of any such incident, the data will be deleted immediately.</Text>

            <Text style={styles.sectionTitle}>9. International Transfers</Text>
            <Text style={styles.paragraph}>Our servers and third-party processors may be located in regions such as the UAE, India, or European Economic Area (EEA). Data transfers are safeguarded by standard contractual clauses or similar legal mechanisms aligned with UAE Data Protection Law and GDPR-equivalent frameworks.</Text>

            <Text style={styles.sectionTitle}>10. Changes to This Privacy Policy</Text>
            <Text style={styles.paragraph}>We reserve the right to amend this Privacy Policy at any time. Changes will be reflected via:</Text>
            <Text style={styles.paragraph}>In-app announcements and prompts</Text>
            <Text style={styles.paragraph}>Updated “Effective Date” on this document</Text>
            <Text style={styles.paragraph}>Users are encouraged to review the policy periodically for updates.</Text>

            <Text style={styles.sectionTitle}>11. Contact Information</Text>
            <Text style={styles.paragraph}>For any queries, grievances, or data rights requests, please reach out to us:</Text>
            <Text style={styles.paragraph}>Email: <Text style={styles.link}>support@aiheartlink.com</Text></Text>
            <Text style={styles.paragraph}>Company: AI Heartlink FZE LLC</Text>
            <Text style={styles.paragraph}>Registered Office: Amber Gem Tower, Mezzanine Floor, Sheikh Khalifa Street, P.O Box 4848, Ajman, United Arab Emirates</Text>

            <Text style={[styles.sectionTitle, styles.effectiveDate]}>Effective Date: July 27, 2025</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ed167e',
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  policyContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ed167e',
    marginTop: 24,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: '600',
  },
  link: {
    color: '#ed167e',
    textDecorationLine: 'underline',
  },
  effectiveDate: {
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
});

export default PrivacySettingsScreen;