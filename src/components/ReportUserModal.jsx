// // File: ReportUserModal.js

// import React, { useState } from 'react';
// import {
//   Modal,
//   View,
//   Text,
//   TouchableOpacity,
//   TouchableWithoutFeedback,
//   StyleSheet,
//   ScrollView,
//   Alert,
//   ActivityIndicator,
// } from 'react-native';
// import Icon from 'react-native-vector-icons/Ionicons';
// import { useAuth } from '../../context/AuthContext';
// import BASE_URL from '../../config/config';

// // Predefined report options based on API documentation
// const REPORT_TYPES = [
//   { label: 'User', value: 'user' },
//   { label: 'Post', value: 'post' },
//   { label: 'Comment', value: 'comment' },
// ];

// const REASONS = [
//   { label: 'Violence/Threats', value: 'violence_threats' },
//   { label: 'Harassment', value: 'harassment' },
//   { label: 'Hate Speech', value: 'hate_speech' },
//   { label: 'Inappropriate Content', value: 'inappropriate_content' },
//   { label: 'Impersonation', value: 'impersonation' },
//   { label: 'Spam', value: 'spam' },
//   { label: 'Other', value: 'other' },
// ];

// const CATEGORIES = [
//   { label: 'Content', value: 'content' },
//   { label: 'Behavior', value: 'behavior' },
//   { label: 'Technical', value: 'technical' },
//   { label: 'Legal', value: 'legal' },
//   { label: 'Safety', value: 'safety' },
// ];

// const SEVERITIES = [
//   { label: 'Low', value: 'low' },
//   { label: 'Medium', value: 'medium' },
//   { label: 'High', value: 'high' },
//   { label: 'Urgent', value: 'urgent' },
//   { label: 'Critical', value: 'critical' },
// ];

// const ReportUserModal = ({ 
//   visible, 
//   onClose, 
//   user, 
//   onReportSuccess 
// }) => {
//   const { token } = useAuth();
//   const [step, setStep] = useState(1); // 1: type/reason, 2: details
//   const [reportType, setReportType] = useState('user');
//   const [reason, setReason] = useState('');
//   const [category, setCategory] = useState('behavior');
//   const [description, setDescription] = useState('');
//   const [severity, setSeverity] = useState('medium');
//   const [isAnonymous, setIsAnonymous] = useState(false);
//   const [submitting, setSubmitting] = useState(false);

//   const resetForm = () => {
//     setStep(1);
//     setReportType('user');
//     setReason('');
//     setCategory('behavior');
//     setDescription('');
//     setSeverity('medium');
//     setIsAnonymous(false);
//     setSubmitting(false);
//   };

//   const handleClose = () => {
//     resetForm();
//     onClose();
//   };

//   const handleSubmit = async () => {
//     if (!description.trim() || description.trim().length < 10) {
//       Alert.alert('Error', 'Please provide a detailed description (minimum 10 characters).');
//       return;
//     }

//     setSubmitting(true);
    
//     try {
//       const response = await fetch(`${BASE_URL}/api/v1/user-handling/report`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           reportedUserId: user._id,
//           reportType,
//           reason,
//           category,
//           description: description.trim(),
//           severity,
//           isAnonymous,
//         }),
//       });

//       const data = await response.json();

//       if (response.ok && data.success) {
//         Alert.alert('Success', 'Your report has been submitted successfully.');
//         if (onReportSuccess) onReportSuccess();
//         handleClose();
//       } else {
//         throw new Error(data.message || 'Failed to submit report');
//       }
//     } catch (error) {
//       console.error('Report submission error:', error);
//       Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const renderStepOne = () => (
//     <View style={styles.stepContainer}>
//       <Text style={styles.sectionTitle}>Report Type</Text>
//       <View style={styles.optionsContainer}>
//         {REPORT_TYPES.map((type) => (
//           <TouchableOpacity
//             key={type.value}
//             style={[
//               styles.optionButton,
//               reportType === type.value && styles.selectedOption
//             ]}
//             onPress={() => setReportType(type.value)}
//           >
//             <Text style={[
//               styles.optionText,
//               reportType === type.value && styles.selectedOptionText
//             ]}>
//               {type.label}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       <Text style={styles.sectionTitle}>Reason</Text>
//       <View style={styles.optionsContainer}>
//         {REASONS.map((r) => (
//           <TouchableOpacity
//             key={r.value}
//             style={[
//               styles.optionButton,
//               reason === r.value && styles.selectedOption
//             ]}
//             onPress={() => setReason(r.value)}
//           >
//             <Text style={[
//               styles.optionText,
//               reason === r.value && styles.selectedOptionText
//             ]}>
//               {r.label}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       <Text style={styles.sectionTitle}>Category</Text>
//       <View style={styles.optionsContainer}>
//         {CATEGORIES.map((cat) => (
//           <TouchableOpacity
//             key={cat.value}
//             style={[
//               styles.optionButton,
//               category === cat.value && styles.selectedOption
//             ]}
//             onPress={() => setCategory(cat.value)}
//           >
//             <Text style={[
//               styles.optionText,
//               category === cat.value && styles.selectedOptionText
//             ]}>
//               {cat.label}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       <View style={styles.navigationButtons}>
//         <TouchableOpacity 
//           style={[styles.navButton, styles.cancelButton]} 
//           onPress={handleClose}
//         >
//           <Text style={styles.navButtonText}>Cancel</Text>
//         </TouchableOpacity>
//         <TouchableOpacity 
//           style={[styles.navButton, styles.nextButton]} 
//           onPress={() => setStep(2)}
//           disabled={!reason}
//         >
//           <Text style={styles.navButtonText}>Next</Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );

//   const renderStepTwo = () => (
//     <View style={styles.stepContainer}>
//       <Text style={styles.sectionTitle}>Severity</Text>
//       <View style={styles.optionsContainer}>
//         {SEVERITIES.map((s) => (
//           <TouchableOpacity
//             key={s.value}
//             style={[
//               styles.optionButton,
//               severity === s.value && styles.selectedOption
//             ]}
//             onPress={() => setSeverity(s.value)}
//           >
//             <Text style={[
//               styles.optionText,
//               severity === s.value && styles.selectedOptionText
//             ]}>
//               {s.label}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       <Text style={styles.sectionTitle}>Description</Text>
//       <View style={styles.textInputContainer}>
//         <TextInput
//           style={styles.textInput}
//           placeholder="Please provide detailed information about the issue (minimum 10 characters)"
//           placeholderTextColor="#9ca3af"
//           multiline
//           numberOfLines={4}
//           value={description}
//           onChangeText={setDescription}
//         />
//         <Text style={styles.charCount}>{description.length}/500</Text>
//       </View>

//       <View style={styles.checkboxContainer}>
//         <TouchableOpacity 
//           style={styles.checkbox} 
//           onPress={() => setIsAnonymous(!isAnonymous)}
//         >
//           {isAnonymous && <Icon name="checkmark" size={16} color="#fff" />}
//         </TouchableOpacity>
//         <Text style={styles.checkboxLabel}>Submit anonymously</Text>
//       </View>

//       <View style={styles.navigationButtons}>
//         <TouchableOpacity 
//           style={[styles.navButton, styles.cancelButton]} 
//           onPress={handleClose}
//         >
//           <Text style={styles.navButtonText}>Cancel</Text>
//         </TouchableOpacity>
//         <TouchableOpacity 
//           style={[styles.navButton, styles.nextButton]} 
//           onPress={handleSubmit}
//           disabled={submitting || !description.trim() || description.trim().length < 10}
//         >
//           {submitting ? (
//             <ActivityIndicator size="small" color="#fff" />
//           ) : (
//             <Text style={styles.navButtonText}>Submit Report</Text>
//           )}
//         </TouchableOpacity>
//       </View>
//     </View>
//   );

//   return (
//     <Modal
//       visible={visible}
//       transparent={true}
//       animationType="slide"
//       onRequestClose={handleClose}
//     >
//       <TouchableWithoutFeedback onPress={handleClose}>
//         <View style={styles.overlay}>
//           <TouchableWithoutFeedback>
//             <View style={styles.modalContainer}>
//               <View style={styles.header}>
//                 <Text style={styles.title}>Report User</Text>
//                 <TouchableOpacity onPress={handleClose}>
//                   <Icon name="close" size={24} color="#fff" />
//                 </TouchableOpacity>
//               </View>
              
//               <View style={styles.userHeader}>
//                 <View style={styles.avatarPlaceholder} />
//                 <View>
//                   <Text style={styles.userName}>{user?.fullName || 'Unknown User'}</Text>
//                   <Text style={styles.userHandle}>@{user?.username || 'username'}</Text>
//                 </View>
//               </View>
              
//               <ScrollView style={styles.content}>
//                 {step === 1 ? renderStepOne() : renderStepTwo()}
//               </ScrollView>
//             </View>
//           </TouchableWithoutFeedback>
//         </View>
//       </TouchableWithoutFeedback>
//     </Modal>
//   );
// };

// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0, 0, 0, 0.8)',
//     justifyContent: 'flex-end',
//   },
//   modalContainer: {
//     backgroundColor: '#1f2937',
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//     maxHeight: '80%',
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: 20,
//     borderBottomWidth: 1,
//     borderBottomColor: '#374151',
//   },
//   title: {
//     color: '#fff',
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   userHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 20,
//     borderBottomWidth: 1,
//     borderBottomColor: '#374151',
//   },
//   avatarPlaceholder: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: '#374151',
//     marginRight: 15,
//   },
//   userName: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   userHandle: {
//     color: '#9ca3af',
//     fontSize: 14,
//   },
//   content: {
//     padding: 20,
//   },
//   stepContainer: {
    
//   },
//   sectionTitle: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//     marginBottom: 10,
//     marginTop: 15,
//   },
//   optionsContainer: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 10,
//   },
//   optionButton: {
//     backgroundColor: '#374151',
//     paddingHorizontal: 15,
//     paddingVertical: 8,
//     borderRadius: 20,
//   },
//   selectedOption: {
//     backgroundColor: '#ed167e',
//   },
//   optionText: {
//     color: '#e5e7eb',
//     fontSize: 14,
//   },
//   selectedOptionText: {
//     color: '#fff',
//     fontWeight: '600',
//   },
//   textInputContainer: {
//     backgroundColor: '#374151',
//     borderRadius: 10,
//     padding: 15,
//   },
//   textInput: {
//     color: '#fff',
//     fontSize: 16,
//     textAlignVertical: 'top',
//     height: 100,
//   },
//   charCount: {
//     color: '#9ca3af',
//     fontSize: 12,
//     textAlign: 'right',
//     marginTop: 5,
//   },
//   checkboxContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginVertical: 20,
//   },
//   checkbox: {
//     width: 20,
//     height: 20,
//     borderWidth: 1,
//     borderColor: '#9ca3af',
//     borderRadius: 4,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 10,
//   },
//   checkboxLabel: {
//     color: '#e5e7eb',
//     fontSize: 16,
//   },
//   navigationButtons: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 20,
//   },
//   navButton: {
//     flex: 1,
//     paddingVertical: 15,
//     borderRadius: 10,
//     alignItems: 'center',
//     marginHorizontal: 5,
//   },
//   cancelButton: {
//     backgroundColor: '#374151',
//   },
//   nextButton: {
//     backgroundColor: '#ed167e',
//   },
//   navButtonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//   },
// });

// export default ReportUserModal;