import { View, Text, FlatList, StyleSheet } from 'react-native';

const ChatList = () => {
  const chats = [
    { id: '1', name: 'Ava' },
    { id: '2', name: 'Isabella' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Chats</Text>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.chatBox}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.onlineStatus}>🟢 Online</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#222',
    borderRadius: 10,
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  chatBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    marginVertical: 5,
  },
  name: {
    color: '#fff',
    fontSize: 16,
  },
  onlineStatus: {
    color: 'green',
    fontSize: 14,
  },
});

export default ChatList;
