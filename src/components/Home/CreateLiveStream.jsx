// src/components/CreateLiveStream.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import BASE_URL from '../../config/config'; // Assumes this points to 'https://backendforheartlink.in'
import useWebRTC from '../../hooks/useWEBRTC';
import { RTCView } from 'react-native-webrtc';

const CreateLiveStream = ({ navigation }) => {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();

  const {
    localStream,
    isWebRTCConnected,
    webRTCError: webRTCErrorMsg,
    initializeLocalStream,
    createOfferAndSignal,
    cleanupWebRTC,
  } = useWebRTC(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('FOLLOWERS_ONLY'); // Restricted
  const [category, setCategory] = useState('OTHER');
  const [settings, setSettings] = useState({
    allowChat: true,
    allowReactions: true,
    maxViewers: 1000,
  });

  const [streamId, setStreamId] = useState(null);
  const [streamStatus, setStreamStatus] = useState('IDLE');
  const [apiError, setApiError] = useState('');
  const [currentStreams, setCurrentStreams] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingStreams, setCheckingStreams] = useState(true);
  const [endingAll, setEndingAll] = useState(false); // New state for ending all

  const visibilities = ['FOLLOWERS_ONLY']; // Restricted
  const categories = ['GAMING', 'MUSIC', 'TALK_SHOW', 'EDUCATION', 'SPORTS', 'OTHER'];

  const displayError = apiError || webRTCErrorMsg;
  const hasActiveStreams = useMemo(() => currentStreams.length > 0, [currentStreams]);

  useEffect(() => {
    if (!isConnected) {
      setApiError('Socket connection lost. Please check your internet.');
    } else {
       setApiError('');
    }
  }, [isConnected]);

  useEffect(() => {
    fetchCurrentStreams("component_mount_or_token_change");
  }, [token]);

  const fetchCurrentStreams = useCallback(async (source = "unknown") => {
    console.log(`[fetchCurrentStreams] Called from: ${source}`);
    setCheckingStreams(true);
    if (!token) {
        console.log("[fetchCurrentStreams] No token available.");
        setCurrentStreams([]);
        setCheckingStreams(false);
        return;
    }
    try {
      console.log("[fetchCurrentStreams] Fetching active streams...");
      const response = await fetch(`${BASE_URL}/api/v1/live/active`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      console.log(`[fetchCurrentStreams] API Response Status: ${response.status}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log("[fetchCurrentStreams] API returned 404 - No active streams.");
          setCurrentStreams([]);
          setCheckingStreams(false);
          return;
        } else {
          const errorText = await response.text();
          console.error(`[fetchCurrentStreams] HTTP Error ${response.status}: ${errorText}`);
          throw new Error(`Failed to fetch streams: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log("[fetchCurrentStreams] Raw API Response Data:", JSON.stringify(data, null, 2));

      if (data.success) {
        const streamsArray = Array.isArray(data.data?.streams) ? data.data.streams : [];
        console.log(`[fetchCurrentStreams] Successfully parsed ${streamsArray.length} stream(s).`);
        setCurrentStreams(streamsArray);
        setApiError('');
      } else {
        console.error("[fetchCurrentStreams] API returned success=false:", data.message);
        throw new Error(data.message || 'API reported failure while fetching streams.');
      }
    } catch (err) {
      console.error('[fetchCurrentStreams] Error occurred:', err);
      setApiError(`Failed to fetch live streams: ${err.message}`);
      setCurrentStreams([]);
    } finally {
      console.log("[fetchCurrentStreams] Completed.");
      setCheckingStreams(false);
    }
  }, [token]);

  const onRefresh = useCallback(() => {
    console.log("[onRefresh] Pull-to-refresh initiated.");
    setRefreshing(true);
    fetchCurrentStreams("pull_to_refresh").finally(() => {
        setRefreshing(false);
    });
  }, [fetchCurrentStreams]);

  // --- Function: End All Active Streams using REST API ---
  const endAllStreams = async () => {
    // if (!socket || !isConnected) { // Removed socket check for API call
    //     Alert.alert('Error', 'Connection is not active.');
    //     return;
    // }
    if (currentStreams.length === 0) {
        Alert.alert('Info', 'No active streams to end.');
        return;
    }
    if (!token) {
        Alert.alert('Error', 'Authentication required.');
        return;
    }

    setEndingAll(true);
    setApiError('');

    try {
        console.log(`[endAllStreams] Attempting to end ${currentStreams.length} stream(s) via REST API.`);

        // Create an array of promises for ending each stream
        const endPromises = currentStreams.map(async (stream) => {
            const id = stream[" streamId "]; // Adjust key access if needed based on actual API response
            if (!id) {
                console.warn(`[endAllStreams] Skipping stream, no ID found:`, stream);
                return { streamId: 'unknown', success: false, error: 'No ID' };
            }

            try {
                console.log(`[endAllStreams] Calling REST API to end streamId: ${id}`);
                const response = await fetch(`${BASE_URL}/api/v1/live/${id}/end`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    // Body can be empty or {} if the API doesn't require it for this endpoint
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[endAllStreams] REST API Error for ${id}: ${response.status} - ${errorText}`);
                    return { streamId: id, success: false, error: `${response.status} - ${errorText}` };
                }

                const data = await response.json();
                console.log(`[endAllStreams] REST API Success for ${id}:`, data);
                return { streamId: id, success: true, data };

            } catch (apiErr) {
                console.error(`[endAllStreams] Network/Other Error for ${id}:`, apiErr);
                return { streamId: id, success: false, error: apiErr.message };
            }
        });

        // Wait for all end requests to complete
        const results = await Promise.allSettled(endPromises);
        console.log(`[endAllStreams] End stream API calls completed. Results:`, results);

        // Check for any failures if needed for UI feedback
        const failedResults = results.filter(r => r.status === 'fulfilled' && r.value.success === false);
        if (failedResults.length > 0) {
            console.warn('[endAllStreams] Some streams failed to end via API:', failedResults.map(r => r.value));
            // Optionally, you could set a more specific error message based on failures
            // setApiError('Failed to end one or more streams.');
        }

        // --- Proceed with local cleanup and UI updates for the stream being broadcasted locally ---
        if (streamId) {
             cleanupWebRTC();
             setStreamStatus('IDLE');
             setStreamId(null);
             setTitle('');
             setDescription('');
        }

        Alert.alert('Streams Ended', 'All your active streams have been ended. You can now create a new one.');
        console.log("[endAllStreams] Waiting before refreshing stream list...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for backend

        console.log("[endAllStreams] Refreshing stream list...");
        await fetchCurrentStreams("endAllStreams");

    } catch (err) {
        console.error('[endAllStreams] Unexpected Error:', err);
        setApiError('Failed to end one or more streams.');
        Alert.alert('Error', 'Failed to end one or more streams.');
    } finally {
        setEndingAll(false);
    }
  };

  const createStream = async () => {
    console.log("[createStream] Attempting to create a new stream.");

    if (hasActiveStreams) {
        console.log("[createStream] Prevented creation because hasActiveStreams is true.");
        Alert.alert(
            'Active Stream Found',
            'You already have active stream(s). Please end them first or use "End All & Create New".',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'End All & Create New', onPress: endAllStreams }
            ]
        );
        return;
    }

    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a stream title.');
      return;
    }
    if (!token) {
      Alert.alert('Authentication Error', 'You are not logged in.');
      return;
    }

    setStreamStatus('CREATING');
    setApiError('');

    try {
      const requestBody = {
        title: title.trim(),
        description: description.trim(),
        visibility: visibility,
        category: category,
        settings: {}
      };
      requestBody.settings[" allowChat "] = settings.allowChat === true;
      requestBody.settings[" allowReactions "] = settings.allowReactions === true;
      requestBody.settings[" maxViewers "] = Number(settings.maxViewers) || 1000;

      console.log('[createStream] Sending create stream request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${BASE_URL}/api/v1/live/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[createStream] Create Stream Response Status: ${response.status}`);
      let data;
      let responseText = '';
      try {
         responseText = await response.text();
         console.log(`[createStream] Raw Create Stream Response Text: ${responseText}`);
         data = JSON.parse(responseText);
         console.log(`[createStream] Parsed Create Stream Response Data:`, data);
      } catch (parseError) {
          console.error('[createStream] Error parsing response JSON:', parseError);
          console.error('[createStream] Response Text:', responseText);
          data = { success: false, message: `Invalid response format. Status: ${response.status}` };
      }

      if (response.ok && data.success === true) {
        const newStreamId = data.data?.stream?.[" streamId "];
        if (!newStreamId) {
             const errorMsg = 'Stream ID not found in successful response';
             console.error(`[createStream] ${errorMsg}`, data);
             throw new Error(errorMsg);
        }
        setStreamId(newStreamId);
        setStreamStatus('WAITING');
        console.log('[createStream] Stream created successfully:', newStreamId);
        Alert.alert('Success', 'Stream created! Initializing camera...');
        const success = await initializeLocalStream();
        if (!success) {
            setStreamStatus('ERROR');
        }
      } else {
        let errorMessage = 'Failed to create stream.';
        if (data && data.message) {
          errorMessage = data.message;
        } else if (responseText) {
          errorMessage = `Server Error: ${responseText.substring(0, 100)}...`;
        } else if (!response.ok) {
          errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        }
        console.error('[createStream] Stream creation failed:', errorMessage, data);
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('[createStream] Error (catch block):', err);
      const displayMessage = err.message || 'An unexpected error occurred.';
      setApiError(displayMessage);
      setStreamStatus('ERROR');
      Alert.alert('Error', displayMessage);
    }
  };

  const startBroadcasting = async () => {
    if (streamStatus !== 'WAITING' || !streamId || !socket || !isConnected || !localStream) {
      Alert.alert('Error', 'Stream is not ready or connection lost.');
      return;
    }

    setStreamStatus('LIVE');
    try {
        console.log(`[startBroadcasting] Initiating broadcast for streamId: ${streamId}`);
        const success = await createOfferAndSignal();
        if (!success) {
            console.log(`[startBroadcasting] Failed for streamId: ${streamId}`);
            setStreamStatus('WAITING');
        } else {
             Alert.alert('Broadcasting', 'Your stream is now live!');
             console.log(`[startBroadcasting] Success for streamId: ${streamId}`);
        }
    } catch (err) {
        console.error('[startBroadcasting] Unexpected error:', err);
        setStreamStatus('WAITING');
        Alert.alert('Error', 'An unexpected error occurred while starting.');
    }
  };

  // --- Function: End a Single Stream using REST API ---
  const endStream = async (id) => {
     console.log(`[endStream] Attempting to end stream with ID: ${id}`);
     if (!id) {
        Alert.alert('Error', 'Invalid stream ID.');
        return;
     }
     if (!token) { // Check for token instead of socket for API call
        Alert.alert('Error', 'Authentication required.');
        return;
     }
     // if (!socket || !isConnected) { // Removed socket check for API call
     //    Alert.alert('Error', 'Connection is not active.');
     //    return;
     // }

     if (id === streamId) {
        setStreamStatus('ENDING');
     }

     try {
         console.log(`[endStream] Calling REST API to end streamId: ${id}`);

         // --- Use REST API to end the stream ---
         const response = await fetch(`${BASE_URL}/api/v1/live/${id}/end`, {
             method: 'POST',
             headers: {
                 'Authorization': `Bearer ${token}`, // JWT token required
                 'Content-Type': 'application/json',
             },
             // Body can be empty or {} if the API doesn't require it for this endpoint
             // body: JSON.stringify({})
         });

         console.log(`[endStream] REST API Response Status: ${response.status}`);

         if (!response.ok) {
             // Handle specific API errors if needed, or just throw a generic error
             const errorData = await response.text(); // Get raw text in case it's not JSON
             console.error(`[endStream] REST API Error ${response.status}: ${errorData}`);
             throw new Error(`Failed to end stream via API: ${response.status} ${response.statusText} - ${errorData}`);
         }

         const data = await response.json();
         console.log(`[endStream] REST API Success Response:`, data);

         // --- Proceed with local cleanup and UI updates as before ---
         if (id === streamId) {
             cleanupWebRTC();
             setStreamStatus('IDLE');
             setStreamId(null);
             setTitle('');
             setDescription('');
             Alert.alert('Stream Ended', 'Your live stream has finished.');
             console.log(`[endStream] Local stream state cleared for streamId: ${id}`);
         } else {
             Alert.alert('Stream Ended', 'The selected live stream has finished.');
         }

         console.log("[endStream] Waiting before refreshing stream list...");
         await new Promise(resolve => setTimeout(resolve, 1500)); // Short delay before refresh

         console.log("[endStream] Refreshing stream list...");
         await fetchCurrentStreams("endStream");

     } catch (err) {
         console.error('[endStream] Error:', err);
         // Revert status if it was the local stream being ended
         if (id === streamId) {
             setStreamStatus('LIVE'); // Or perhaps 'WAITING' depending on desired UX on error
         }
         Alert.alert('Error', `Failed to end stream: ${err.message}`);
     }
  };

  const handleStartBroadcast = () => {
    if (streamStatus === 'WAITING') {
      startBroadcasting();
    } else if (streamStatus === 'LIVE') {
      Alert.alert('Already Live', 'The stream is currently broadcasting.');
    } else {
       Alert.alert('Not Ready', 'Please create a stream and wait for camera.');
    }
  };

  const handleEndStream = (id) => {
    const streamIdToUse = id || streamId;
    if (!streamIdToUse) {
       Alert.alert('No Active Stream', 'There is no stream currently running to end.');
       return;
    }
    Alert.alert(
      'End Stream',
      id === streamId
        ? 'Are you sure you want to end this live stream?'
        : id
        ? 'Are you sure you want to end this stream?'
        : 'Are you sure you want to end this live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Stream', onPress: () => endStream(streamIdToUse), style: 'destructive' },
      ]
    );
  };

  if (checkingStreams) {
      return (
          <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#ff0000" />
              <Text style={styles.loadingText}>Checking for active streams...</Text>
          </View>
      );
  }

  // --- Determine if main "Create Stream" button should be disabled ---
  const isCreateButtonDisabled = !token || hasActiveStreams || streamStatus !== 'IDLE';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ff0000"
          colors={['#ff0000']}
        />
      }
    >
      <Text style={styles.header}>Create Live Stream</Text>

      {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

      {/* --- Active Streams Section --- */}
      <View style={styles.currentStreamsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Active Streams</Text>
          <TouchableOpacity onPress={() => fetchCurrentStreams("manual_refresh_button")}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {currentStreams.length === 0 ? (
          <Text style={styles.noStreamsText}>No active streams found.</Text>
        ) : (
          <>
            {currentStreams.map((stream) => (
              <View key={stream[" streamId "]} style={styles.streamItem}>
                <View style={styles.streamInfo}>
                  <Text style={styles.streamTitle} numberOfLines={1}>{stream.title}</Text>
                  <Text style={styles.streamId}>ID: {stream[" streamId "]}</Text>
                  <Text style={styles.streamStatus}>Status: {stream.status}</Text>
                </View>
                <TouchableOpacity
                  style={styles.endStreamButton}
                  onPress={() => handleEndStream(stream[" streamId "])}
                >
                  <Text style={styles.endStreamButtonText}>End</Text>
                </TouchableOpacity>
              </View>
            ))}
            {/* --- End All Button --- */}
            <TouchableOpacity
                style={[styles.button, styles.buttonEndAll, endingAll && styles.buttonDisabled]}
                onPress={endAllStreams}
                disabled={endingAll}
            >
                 {endingAll ? (
                    <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.buttonText}> Ending...</Text>
                    </>
                 ) : (
                    <Text style={styles.buttonText}>End All & Create New</Text>
                 )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* --- Stream Creation Form --- */}
      <View style={hasActiveStreams ? styles.disabledForm : null}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter stream title"
            editable={!hasActiveStreams && streamStatus === 'IDLE'}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter stream description"
            multiline
            editable={!hasActiveStreams && streamStatus === 'IDLE'}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.pickerContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.pickerButton,
                  category === cat && styles.pickerButtonSelected,
                ]}
                onPress={() => setCategory(cat)}
                disabled={hasActiveStreams || streamStatus !== 'IDLE'}
              >
                <Text style={styles.pickerButtonText}>{cat.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Visibility</Text>
          <View style={styles.pickerContainer}>
            {visibilities.map((vis) => (
              <TouchableOpacity
                key={vis}
                style={[
                  styles.pickerButton,
                  visibility === vis && styles.pickerButtonSelected,
                ]}
                onPress={() => setVisibility(vis)}
                disabled={hasActiveStreams || streamStatus !== 'IDLE'}
              >
                <Text style={styles.pickerButtonText}>{vis.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {streamId && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Stream ID: {streamId}</Text>
            <Text style={styles.statusText}>Status: {streamStatus}</Text>
            {isWebRTCConnected && <Text style={styles.statusText}>WebRTC: Connected</Text>}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
                styles.button,
                styles.buttonCreate,
                isCreateButtonDisabled && styles.buttonDisabled, // Visual disable
                hasActiveStreams && styles.buttonCreateDisabledWithStreams // Specific style if streams exist
            ]}
            onPress={createStream}
            disabled={isCreateButtonDisabled} // Actual disable
          >
            <Text style={styles.buttonText}>Create Stream</Text>
          </TouchableOpacity>

          {(streamStatus === 'WAITING' || streamStatus === 'LIVE') && (
            <TouchableOpacity
              style={[styles.button, streamStatus === 'WAITING' ? styles.buttonStart : styles.buttonLive]}
              onPress={handleStartBroadcast}
              disabled={!isConnected || !localStream}
            >
              <Text style={styles.buttonText}>
                {streamStatus === 'WAITING' ? 'Start Broadcasting' : 'Live - Manage'}
              </Text>
            </TouchableOpacity>
          )}

          {(streamStatus === 'WAITING' || streamStatus === 'LIVE') && (
            <TouchableOpacity style={[styles.button, styles.buttonEnd]} onPress={() => handleEndStream(streamId)}>
              <Text style={styles.buttonText}>End Stream</Text>
            </TouchableOpacity>
          )}

          {streamStatus === 'CREATING' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff0000" />
              <Text style={styles.loadingText}>Creating stream...</Text>
            </View>
          )}
          {streamStatus === 'ENDING' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff0000" />
              <Text style={styles.loadingText}>Ending stream...</Text>
            </View>
          )}
        </View>

        <View style={styles.previewContainer}>
          {localStream ? (
            <>
              <RTCView streamURL={localStream.toURL()} style={styles.rtcView} objectFit="cover" />
              <Text style={styles.previewText}>Your Camera Preview</Text>
            </>
          ) : (
            <Text style={styles.previewText}>
              {streamStatus === 'WAITING' ? 'Initializing Camera...' : 'Preview will appear here'}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

// --- COMPLETE Styles ---
const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#000',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#fff',
  },
  errorText: {
    color: '#ff4444',
    marginBottom: 10,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#111',
    color: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerButton: {
    padding: 10,
    margin: 5,
    backgroundColor: '#222',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#333',
  },
  pickerButtonSelected: {
    backgroundColor: '#cc0000',
    borderColor: '#ff0000',
  },
  pickerButtonText: {
    color: '#fff',
  },
  statusContainer: {
    padding: 10,
    backgroundColor: '#111',
    borderRadius: 5,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    flexWrap: 'wrap',
  },
  button: {
    flex: 1,
    margin: 5,
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center', // For aligning text/indicator
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row', // For icon/text alignment
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonCreate: {
    backgroundColor: '#007700', // Dark green
    borderColor: '#00aa00',
  },
  buttonCreateDisabledWithStreams: {
    backgroundColor: '#555', // Darker if streams exist
    borderColor: '#444',
  },
  buttonStart: {
    backgroundColor: '#007700', // Dark green
    borderColor: '#00aa00',
  },
  buttonLive: {
    backgroundColor: '#cc0000', // Red
    borderColor: '#ff0000',
  },
  buttonEnd: {
    backgroundColor: '#333', // Dark gray
    borderColor: '#ff0000',
  },
  buttonEndAll: { // --- New Style ---
    backgroundColor: '#8B0000', // Darker red
    borderColor: '#A52A2A', // Brownish red border
    margin: 5, // Add margin like other buttons
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonEndAllText: { // --- New Style ---
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  previewContainer: {
    height: 250,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  rtcView: {
    width: '100%',
    height: '100%',
  },
  previewText: {
    position: 'absolute',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 5,
    borderRadius: 3,
  },
  currentStreamsContainer: {
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshText: {
    color: '#ff0000',
    fontWeight: '600',
  },
  noStreamsText: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  streamItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#111',
    borderRadius: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  streamInfo: {
    flex: 1,
    marginRight: 10,
  },
  streamTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  streamId: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  streamStatus: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  endStreamButton: {
    backgroundColor: '#cc0000',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ff0000',
  },
  endStreamButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  disabledForm: {
    opacity: 0.5,
  },
  buttonDisabled: {
    backgroundColor: '#555',
    borderColor: '#444',
    opacity: 0.7, // Make it even more visually disabled
  },
});

export default CreateLiveStream;
