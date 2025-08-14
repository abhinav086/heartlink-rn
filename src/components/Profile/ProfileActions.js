// import React from 'react';
// import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

// const ProfileActions = () => {
//   return (
//     <View style={styles.container}>
//       {/* Stats: Followers / Following / Posts */}
//       <View style={styles.statsContainer}>
//         <View style={styles.stat}>
//           <Text style={styles.statNumber}>9421</Text>
//           <Text style={styles.statLabel}>Followers</Text>
//         </View>
//         <View style={styles.stat}>
//           <Text style={styles.statNumber}>728</Text>
//           <Text style={styles.statLabel}>Following</Text>
//         </View>
//         <View style={styles.stat}>
//           <Text style={styles.statNumber}>13</Text>
//           <Text style={styles.statLabel}>Posts</Text>
//         </View>
//       </View>

//       {/* Button Row */}
//       <View style={styles.buttonRow}>
//         {/* Follow Button */}
//         <TouchableOpacity style={[styles.button, styles.followButton]}>
//           <Text style={styles.buttonText}>Follow</Text>
//         </TouchableOpacity>

//         {/* Impress Button */}
//         <TouchableOpacity style={[styles.button, styles.impressButton]}>
//           <Text style={styles.buttonText}>Impress</Text>
//         </TouchableOpacity>

//         {/* Wink Button */}
//         <TouchableOpacity style={[styles.button, styles.winkButton]}>
//           <Text style={styles.buttonText}>Wink</Text>
//         </TouchableOpacity>
//       </View>

//       {/* Take on a Date Button */}
//       <TouchableOpacity style={[styles.dateButton, styles.animatedScale]}>
//         <Text style={styles.dateButtonText}>Take on a Date</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     alignItems: 'center',
//     paddingVertical: 15,
//   },
//   statsContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     width: '100%',
//   },
//   stat: {
//     alignItems: 'center',
//   },
//   statNumber: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: '#fff',
//   },
//   statLabel: {
//     fontSize: 12,
//     color: '#aaa',
//   },

//   /* Button Row */
//   buttonRow: {
//     flexDirection: 'row',
//     marginTop: 15,
//   },

//   /* Individual Buttons */
//   button: {
//     paddingVertical: 8,
//     paddingHorizontal: 16,
//     borderRadius: 20,
//     marginHorizontal: 5,
//     shadowColor: '#000',
//     shadowOpacity: 0.2,
//     shadowOffset: { width: 0, height: 3 },
//   },

//   /* Colors for Buttons */
//   followButton: {
//     backgroundColor: '#ED167E',
//   },
//   impressButton: {
//     backgroundColor: '#FFA500',
//   },
//   winkButton: {
//     backgroundColor: '#6A0DAD',
//   },

//   buttonText: {
//     color: '#fff',
//     fontWeight: 'bold',
//     fontSize: 14,
//   },

//   /* Take on a Date Button */
//   dateButton: {
//     marginTop: 15,
//     backgroundColor: '#FF4500',
//     paddingVertical: 10,
//     paddingHorizontal: 35,
//     borderRadius: 25,
//     shadowColor: '#000',
//     shadowOpacity: 0.3,
//     shadowOffset: { width: 0, height: 4 },
//     elevation: 5,
//   },

//   dateButtonText: {
//     color: '#fff',
//     fontWeight: 'bold',
//     fontSize: 16,
//   },

//   /* Animated Scaling Effect */
//   animatedScale: {
//     transform: [{ scale: 1.05 }],
//   },
// });

// export default ProfileActions;
