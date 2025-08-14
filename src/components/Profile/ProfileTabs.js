// import React, { useState } from 'react';
// import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

// const ProfileTabs = ({ setActiveTab }) => {
//   const [active, setActive] = useState('Posts');

//   const handlePress = (tab) => {
//     setActive(tab);
//     setActiveTab(tab);
//   };

//   return (
//     <View style={styles.container}>
//       {['Posts', 'Saved', 'Tagged'].map((tab) => (
//         <TouchableOpacity key={tab} onPress={() => handlePress(tab)}>
//           <Text style={[styles.tabText, active === tab && styles.activeTab]}>{tab}</Text>
//         </TouchableOpacity>
//       ))}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     borderBottomWidth: 1,
//     borderBottomColor: '#444',
//     paddingVertical: 10,
//   },
//   tabText: {
//     color: '#bbb',
//     fontSize: 16,
//   },
//   activeTab: {
//     color: '#ED167E',
//     fontWeight: 'bold',
//   },
// });

// export default ProfileTabs;
