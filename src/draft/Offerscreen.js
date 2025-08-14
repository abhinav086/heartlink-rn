// import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, FlatList, Image, Modal, ScrollView } from 'react-native';
// import React, { useState } from 'react';
// import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';

// const OffersScreen = () => {
//   const [menuVisible, setMenuVisible] = useState(false);
//   const [selectedOffer, setSelectedOffer] = useState(null);
//   const [filter, setFilter] = useState('All');

//   const offers = [
//     { id: '1', name: 'Priya', type: 'Coffee Date', location: 'Starbucks, Hauz Khas', price: '₹500', image: 'https://via.placeholder.com/150' },
//     { id: '2', name: 'Aarav', type: 'Movie Night', location: 'PVR, Saket', price: '₹1500', image: 'https://via.placeholder.com/150' },
//     { id: '3', name: 'Ananya', type: 'Cafe Hangout', location: 'Cafe Coffee Day, CP', price: '₹800', image: 'https://via.placeholder.com/150' },
//     { id: '4', name: 'Rohan', type: 'Gift Offer', location: '₹5000 Shopping Voucher', price: '₹5000', image: 'https://via.placeholder.com/150' },
//   ];

//   const filters = ['All', 'Coffee Date', 'Movie Night', 'Cafe Hangout', 'Clubbing', 'Gift Offer'];

//   const filteredOffers = filter === 'All' ? offers : offers.filter(offer => offer.type === filter);

//   const renderOffer = ({ item }) => (
//     <Animated.View entering={FadeInUp.delay(100 * parseInt(item.id)).duration(300)}>
//       <TouchableOpacity
//         style={styles.card}
//         onPress={() => setSelectedOffer(item)}
//         activeOpacity={0.8}
//       >
//         <Animated.View entering={ZoomIn.duration(200)}>
//           <Image source={{ uri: item.image }} style={styles.cardImage} />
//         </Animated.View>
//         <Text style={styles.cardName}>{item.name}</Text>
//         <Text style={styles.cardType}>{item.type}</Text>
//         <Text style={styles.cardLocation}>{item.location}</Text>
//         <Text style={styles.cardPrice}>{item.price}</Text>
//         <TouchableOpacity style={styles.cardButton}>
//           <Text style={styles.cardButtonText}>Send Offer</Text>
//         </TouchableOpacity>
//       </TouchableOpacity>
//     </Animated.View>
//   );

//   return (
//     <SafeAreaView style={styles.container}>
//       <View style={styles.header}>
//         <Text style={styles.headerTitle}>MeetSphere Offers</Text>
//         <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)}>
//           <Text style={styles.menuIcon}>☰</Text>
//         </TouchableOpacity>
//       </View>
//       {menuVisible && (
//         <View style={styles.menu}>
//           <TouchableOpacity><Text style={styles.menuItem}>Home</Text></TouchableOpacity>
//           <TouchableOpacity><Text style={styles.menuItem}>Offers</Text></TouchableOpacity>
//           <TouchableOpacity><Text style={styles.menuItem}>Profile</Text></TouchableOpacity>
//           <TouchableOpacity><Text style={styles.menuItem}>Settings</Text></TouchableOpacity>
//         </View>
//       )}
//       <ScrollView horizontal style={styles.filterBar}>
//         {filters.map(f => (
//           <TouchableOpacity
//             key={f}
//             style={[styles.filterButton, filter === f && styles.filterButtonActive]}
//             onPress={() => setFilter(f)}
//           >
//             <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
//           </TouchableOpacity>
//         ))}
//       </ScrollView>
//       <FlatList
//         data={filteredOffers}
//         renderItem={renderOffer}
//         keyExtractor={item => item.id}
//         contentContainerStyle={styles.list}
//       />
//       <Modal
//         visible={!!selectedOffer}
//         animationType="slide"
//         transparent
//       >
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             {selectedOffer && (
//               <>
//                 <Image source={{ uri: selectedOffer.image }} style={styles.modalImage} />
//                 <Text style={styles.modalTitle}>{selectedOffer.name}</Text>
//                 <Text style={styles.modalText}>{selectedOffer.type}</Text>
//                 <Text style={styles.modalText}>{selectedOffer.location}</Text>
//                 <Text style={styles.modalText}>{selectedOffer.price}</Text>
//                 <TouchableOpacity
//                   style={styles.modalButton}
//                   onPress={() => setSelectedOffer(null)}
//                 >
//                   <Text style={styles.modalButtonText}>Close</Text>
//                 </TouchableOpacity>
//               </>
//             )}
//           </View>
//         </View>
//       </Modal>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: 'black',
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: 15,
//     backgroundColor: '#1a1a1a',
//   },
//   headerTitle: {
//     color: 'white',
//     fontSize: 20,
//     fontWeight: 'bold',
//   },
//   menuIcon: {
//     color: '#ed167e',
//     fontSize: 24,
//   },
//   menu: {
//     backgroundColor: '#1a1a1a',
//     padding: 10,
//     marginHorizontal: 15,
//     borderRadius: 8,
//   },
//   menuItem: {
//     color: 'white',
//     padding: 10,
//     fontSize: 16,
//   },
//   filterBar: {
//     padding: 10,
//     backgroundColor: '#1a1a1a',
//   },
//   filterButton: {
//     paddingVertical: 8,
//     paddingHorizontal: 15,
//     marginRight: 10,
//     borderRadius: 20,
//     backgroundColor: '#333',
//   },
//   filterButtonActive: {
//     backgroundColor: '#ed167e',
//   },
//   filterText: {
//     color: 'white',
//     fontSize: 14,
//   },
//   filterTextActive: {
//     color: 'white',
//     fontWeight: 'bold',
//   },
//   list: {
//     padding: 15,
//   },
//   card: {
//     backgroundColor: '#1a1a1a',
//     borderRadius: 10,
//     padding: 15,
//     marginBottom: 15,
//     alignItems: 'center',
//   },
//   cardImage: {
//     width: 80,
//     height: 80,
//     borderRadius: 40,
//     marginBottom: 10,
//   },
//   cardName: {
//     color: 'white',
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   cardType: {
//     color: '#ed167e',
//     fontSize: 16,
//     marginVertical: 5,
//   },
//   cardLocation: {
//     color: '#aaa',
//     fontSize: 14,
//   },
//   cardPrice: {
//     color: '#ed167e',
//     fontSize: 16,
//     fontWeight: 'bold',
//     marginVertical: 5,
//   },
//   cardButton: {
//     backgroundColor: '#ed167e',
//     paddingVertical: 8,
//     paddingHorizontal: 20,
//     borderRadius: 20,
//     marginTop: 10,
//   },
//   cardButtonText: {
//     color: 'white',
//     fontSize: 14,
//     fontWeight: 'bold',
//   },
//   modalContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0,0,0,0.5)',
//   },
//   modalContent: {
//     backgroundColor: '#1a1a1a',
//     borderRadius: 10,
//     padding: 20,
//     alignItems: 'center',
//     width: '80%',
//   },
//   modalImage: {
//     width: 100,
//     height: 100,
//     borderRadius: 50,
//     marginBottom: 10,
//   },
//   modalTitle: {
//     color: 'white',
//     fontSize: 20,
//     fontWeight: 'bold',
//     marginBottom: 10,
//   },
//   modalText: {
//     color: '#aaa',
//     fontSize: 16,
//     marginVertical: 5,
//   },
//   modalButton: {
//     backgroundColor: '#ed167e',
//     paddingVertical: 10,
//     paddingHorizontal: 20,
//     borderRadius: 20,
//     marginTop: 15,
//   },
//   modalButtonText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
// });

// export default OffersScreen;