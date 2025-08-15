// AllStories.js (FIXED VERSION with correct endpoints and live stream integration)
import React, { useState, useEffect } from "react";
import { 
  View, 
  ScrollView, 
  Image, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  RefreshControl
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import BASE_URL from '../../config/config';

const AllStories = () => {
  const navigation = useNavigation();
  const { user: currentUser, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStoriesData();

    // Socket listeners for live stream updates (WebRTC backend)
    if (socket && isConnected) {
      const handleStreamWentLive = (streamData) => {
        console.log('🔴 Live stream went live (socket):', streamData);
        fetchStoriesData(); // Refresh stories to show new live stream
      };

      const handleStreamEnded = (streamData) => {
        console.log('⚫ Live stream ended (socket):', streamData);
        // Update stories to remove live indicator for the streamer
        setStories(prevStories =>
          prevStories.map(story =>
            story.user?._id === streamData.streamer?._id
              ? { ...story, isLive: false, liveStream: null }
              : story
          )
        );
      };

      const handleViewerUpdate = (updateData) => {
        console.log('👥 Viewer count updated (socket):', updateData);
        // Update viewer count for the specific live stream
        setStories(prevStories =>
          prevStories.map(story =>
            story.liveStream?.streamId === updateData.streamId
              ? {
                  ...story,
                  liveStream: {
                    ...story.liveStream,
                    viewersCount: updateData.count || updateData.viewersCount || updateData.currentViewers || 0
                  }
                }
              : story
          )
        );
      };

      // Register socket listeners
      socket.on('stream:went_live', handleStreamWentLive);
      socket.on('stream:ended', handleStreamEnded);
      socket.on('stream:viewer_count', handleViewerUpdate);
      socket.on('stream:viewer_update', handleViewerUpdate); // Alternative event name

      // Cleanup listeners on unmount or socket change
      return () => {
        socket.off('stream:went_live', handleStreamWentLive);
        socket.off('stream:ended', handleStreamEnded);
        socket.off('stream:viewer_count', handleViewerUpdate);
        socket.off('stream:viewer_update', handleViewerUpdate);
      };
    }
  }, [socket, isConnected]);

  const fetchStoriesData = async () => {
    try {
      setLoading(true);
      setRefreshing(false); // Reset refreshing flag regardless of outcome

      if (!token) {
        console.log('No token found');
        setFallbackStory();
        return;
      }

      if (!currentUser) {
        console.log('No current user found');
        setFallbackStory();
        return;
      }

      console.log('=== DEBUG: Current User Data ===');
      console.log('Current User ID:', currentUser?._id);
      console.log('Current User Name:', currentUser?.fullName || currentUser?.username);
      console.log('Current User Profile Pic:', getSafeProfilePic(currentUser));
      console.log('====================');

      // Fetch stories from backend
      const storiesResponse = await fetch(`${BASE_URL}/api/v1/stories/stories`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!storiesResponse.ok) {
        throw new Error(`HTTP ${storiesResponse.status}: ${storiesResponse.statusText}`);
      }

      const storiesData = await storiesResponse.json();
      console.log('Stories API Response:', storiesData);

      // FIXED: Fetch active live streams using the correct endpoint (same as other components)
      let liveStreamsData = [];
      try {
        console.log('🔴 Fetching active live streams...');
        const liveStreamsResponse = await fetch(`${BASE_URL}/api/v1/live/active?limit=50`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('Live streams API response status:', liveStreamsResponse.status);

        if (liveStreamsResponse.ok) {
          const liveData = await liveStreamsResponse.json();
          console.log('Active Live Streams Response:', liveData);
          
          // Handle different response formats
          if (liveData.success !== false) {
            if (liveData.streams && Array.isArray(liveData.streams)) {
              liveStreamsData = liveData.streams;
            } else if (liveData.data && Array.isArray(liveData.data.streams)) {
              liveStreamsData = liveData.data.streams;
            } else if (Array.isArray(liveData)) {
              liveStreamsData = liveData;
            }
          }
          console.log(`✅ Found ${liveStreamsData.length} active live streams`);
        } else if (liveStreamsResponse.status === 404) {
          console.log('No active live streams found (404)');
          liveStreamsData = [];
        } else {
          console.error('Failed to fetch live streams:', liveStreamsResponse.status);
        }
      } catch (liveError) {
        console.error('Error fetching live streams:', liveError);
      }

      // REMOVED: The /my-active endpoint call since it's not consistent with other components
      // Instead, we'll find current user's stream from the active streams list
      let currentUserLiveStreamData = null;
      if (liveStreamsData.length > 0 && currentUser?._id) {
        currentUserLiveStreamData = liveStreamsData.find(stream => 
          stream.streamer?._id === currentUser._id
        );
        if (currentUserLiveStreamData) {
          console.log('✅ Found current user live stream:', currentUserLiveStreamData.streamId);
        }
      }

      const fetchedStories = storiesData.data?.stories || [];
      console.log('Fetched stories count:', fetchedStories.length);
      console.log('Active live streams count:', liveStreamsData.length);

      // Create a map of userId to live stream data for quick lookup
      const userLiveStreamMap = {};

      // Map discovered live streams to users
      liveStreamsData.forEach(stream => {
        if (stream.streamer?._id) {
          const streamerId = stream.streamer._id;
          userLiveStreamMap[streamerId] = {
            ...stream,
            streamId: stream.streamId,
            viewersCount: stream.currentViewers || stream.viewersCount || 0,
            status: stream.status || 'LIVE',
            startedAt: stream.startedAt || stream.createdAt,
            title: stream.title || 'Live Stream',
            description: stream.description,
            thumbnail: stream.thumbnail,
            playbackUrl: stream.playbackUrl || stream.streamUrl,
            streamer: stream.streamer,
            settings: stream.settings,
            rtcConfig: stream.rtcConfig
          };
        }
      });

      console.log('User Live Stream Map:', userLiveStreamMap);

      // Process the stories data
      const processedStories = [];

      // Check if current user has stories or is live
      let currentUserHasStory = false;
      let currentUserStories = [];
      let currentUserIsLive = false;
      let currentUserLiveStream = null;

      const currentUserStoryData = fetchedStories.find(
        userStories => userStories.user._id === currentUser?._id
      );

      if (currentUserStoryData) {
        if (currentUserStoryData.stories && currentUserStoryData.stories.length > 0) {
          currentUserHasStory = true;
          currentUserStories = currentUserStoryData.stories.sort((a, b) =>
            new Date(a.createdAt) - new Date(b.createdAt)
          );
        }
      }

      // Check if current user has an active live stream from the map
      if (userLiveStreamMap[currentUser._id]) {
        currentUserIsLive = true;
        currentUserLiveStream = userLiveStreamMap[currentUser._id];
        console.log('Current user is LIVE:', currentUserLiveStream);
      }

      const currentUserProfilePic = getSafeProfilePic(currentUser);

      // Calculate latest timestamp for "Your Story"
      const yourStoryLatestTimestamp = currentUserStories.length > 0
        ? new Date(Math.max(...currentUserStories.map(s => new Date(s.createdAt).getTime())))
        : null;

      // Create "Your Story" item
      const yourStoryItem = {
        id: 'your_story',
        name: 'Your Story',
        img: currentUserProfilePic,
        add: true,
        isCurrentUser: true,
        user: currentUser,
        hasStory: currentUserHasStory,
        hasViewed: true, // User always views their own story
        stories: currentUserStories,
        storyCount: currentUserStories.length,
        isLive: currentUserIsLive,
        liveStream: currentUserLiveStream,
        latestStoryTimestamp: yourStoryLatestTimestamp,
        liveStreamStartTime: currentUserIsLive && currentUserLiveStream?.startedAt
          ? new Date(currentUserLiveStream.startedAt)
          : null,
      };

      processedStories.push(yourStoryItem);

      // Process other users' stories
      const otherUsersStories = fetchedStories.filter(
        userStories => userStories.user._id !== currentUser?._id
      );

      // Also check for users who are live but don't have stories in the fetched list
      const usersWithStories = new Set(fetchedStories.map(s => s.user._id));

      // Add live streamers who don't have stories
      for (const [streamerId, streamData] of Object.entries(userLiveStreamMap)) {
        if (streamerId !== currentUser._id && !usersWithStories.has(streamerId)) {
          // This user is live but has no stories - add them to the list
          const streamerData = streamData.streamer || {
            _id: streamerId,
            fullName: streamData.streamer?.fullName || streamData.username || 'Live User',
            username: streamData.streamer?.username || streamData.username || 'user',
            photoUrl: streamData.streamer?.photoUrl || streamData.streamer?.profilePic || streamData.thumbnail
          };
          
          const liveOnlyUser = {
            user: streamerData,
            stories: [],
            isLive: true,
            liveStream: streamData
          };
          otherUsersStories.push(liveOnlyUser);
          console.log('Added live-only user:', streamerId, streamerData.username);
        }
      }

      console.log('Processing other users stories:', otherUsersStories.length);

      // Process each user's stories individually with proper API calls
      for (const userStoryData of otherUsersStories) {
        const userId = userStoryData.user._id;
        const userStoriesList = (userStoryData.stories || []).sort((a, b) =>
          new Date(a.createdAt) - new Date(b.createdAt)
        );

        // Check if this user is live using the map
        const isLive = !!userLiveStreamMap[userId];
        const liveStream = userLiveStreamMap[userId] || null;

        console.log(`Processing user ${userId} - Is Live: ${isLive}`);

        // Skip users with no stories and not live
        if (userStoriesList.length === 0 && !isLive) {
          continue;
        }

        try {
          // Fetch individual user's complete profile data
          let detailedUserData = null;
          
          // Try to fetch detailed user profile
          try {
            console.log(`Fetching detailed profile for user ${userId}...`);
            const userProfileResponse = await fetch(`${BASE_URL}/api/v1/users/user/${userId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            console.log(`User profile response status for ${userId}:`, userProfileResponse.status);

            if (userProfileResponse.ok) {
              const userProfileData = await userProfileResponse.json();
              console.log(`User profile API response for ${userId}:`, userProfileData);
              
              if (userProfileData.success && userProfileData.data) {
                detailedUserData = userProfileData.data.user || userProfileData.data;
                console.log(`Successfully fetched detailed user data for ${userId}:`, detailedUserData);
              } else {
                console.warn(`User profile API returned success=false for ${userId}:`, userProfileData);
              }
            } else {
              console.warn(`User profile API failed for ${userId}:`, userProfileResponse.status);
            }
          } catch (fetchError) {
            console.error(`Error fetching detailed profile for ${userId}:`, fetchError);
          }

          // Use detailed data if available, otherwise fall back to original
          const finalUserData = detailedUserData || userStoryData.user;

          // Extract username and profile pic using the same logic as UpdateProfileScreen
          const userName = getSafeUsername(finalUserData);
          const userProfilePic = getSafeProfilePic(finalUserData);

          console.log(`🔍 Final data for user ${userId}:`, {
            originalUserData: finalUserData,
            extractedName: userName,
            extractedProfilePic: userProfilePic,
            isLive: isLive,
            liveStreamViewers: liveStream?.viewersCount || 0,
            storyCount: userStoriesList.length,
            hasStories: userStoriesList.length > 0
          });

          // Determine if user has viewed all stories from this user
          const hasViewedAllStories = userStoriesList.length > 0 ?
            userStoriesList.every(story => story.hasViewed === true) : true;

          // Calculate latest timestamp for this user's stories
          const latestStoryTimestamp = userStoriesList.length > 0
            ? new Date(Math.max(...userStoriesList.map(s => new Date(s.createdAt).getTime())))
            : null;

          const processedUserStory = {
            id: userId,
            name: userName,
            img: userProfilePic,
            add: false,
            isCurrentUser: false,
            user: finalUserData,
            hasStory: userStoriesList.length > 0,
            stories: userStoriesList,
            hasViewed: hasViewedAllStories,
            storyCount: userStoriesList.length,
            // Live stream properties
            isLive: isLive,
            liveStream: liveStream,
            // Add latest story timestamp for sorting
            latestStoryTimestamp: latestStoryTimestamp,
            // Add liveStreamStartTime for sorting if currently live
            liveStreamStartTime: isLive && liveStream?.startedAt
              ? new Date(liveStream.startedAt)
              : null,
          };

          console.log(`Processed story for ${userId}:`, processedUserStory);
          processedStories.push(processedUserStory);

        } catch (error) {
          console.error(`Error processing user ${userId}:`, error);
          
          // Fallback processing with original data
          const userName = getSafeUsername(userStoryData.user);
          const userProfilePic = getSafeProfilePic(userStoryData.user);
          
          console.log(`Using fallback data for ${userId}: name=${userName}, pic=${userProfilePic}`);
          
          const hasViewedAllStories = userStoriesList.length > 0 ?
            userStoriesList.every(story => story.hasViewed === true) : true;

          // Calculate latest timestamp for this user's stories
          const latestStoryTimestamp = userStoriesList.length > 0
            ? new Date(Math.max(...userStoriesList.map(s => new Date(s.createdAt).getTime())))
            : null;

          processedStories.push({
            id: userId,
            name: userName,
            img: userProfilePic,
            add: false,
            isCurrentUser: false,
            user: userStoryData.user,
            hasStory: userStoriesList.length > 0,
            stories: userStoriesList,
            hasViewed: hasViewedAllStories,
            storyCount: userStoriesList.length,
            // Live stream properties
            isLive: isLive,
            liveStream: liveStream,
            // Add latest story timestamp for sorting
            latestStoryTimestamp: latestStoryTimestamp,
            // Add liveStreamStartTime for sorting if currently live
            liveStreamStartTime: isLive && liveStream?.startedAt
              ? new Date(liveStream.startedAt)
              : null,
          });
        }
      }

      // Sort stories: Live streams first, then unviewed stories, then viewed, then by recency
      const sortedStories = [
        processedStories[0], // Keep "Your Story" first
        ...processedStories.slice(1).sort((a, b) => {
          // Rule 1: Live streams always come first
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;

          // If both are live, sort by live stream start time (ascending: older live streams first)
          if (a.isLive && b.isLive) {
            const timeA = a.liveStreamStartTime?.getTime();
            const timeB = b.liveStreamStartTime?.getTime();

            if (timeA && timeB) {
              return timeA - timeB;
            }
            if (timeA) return -1;
            if (timeB) return 1;
            return 0;
          }

          // Rule 2: If both not live, prioritize unviewed stories
          if (!a.hasViewed && b.hasViewed) return -1;
          if (a.hasViewed && !b.hasViewed) return 1;

          // Rule 3: If both not live AND same viewed status, sort by latest story timestamp (ascending)
          const tsA = a.latestStoryTimestamp?.getTime();
          const tsB = b.latestStoryTimestamp?.getTime();

          if (tsA && tsB) {
            return tsA - tsB;
          }
          if (tsA) return -1;
          if (tsB) return 1;
          return 0;
        })
      ];

      console.log('\n=== Final processed stories ===');
      sortedStories.forEach((story, index) => {
        console.log(`${index}: ${story.name} - isLive: ${story.isLive} - viewers: ${story.liveStream?.viewersCount || 0} - storyCount: ${story.storyCount} - latestTimestamp: ${story.latestStoryTimestamp?.toISOString() || 'N/A'}`);
      });

      setStories(sortedStories);

    } catch (error) {
      console.error('Error fetching stories:', error);
      // Alert.alert(
      //   'Error Loading Stories',
      //   'Could not load stories. Please check your connection and try again.',
      //   [{ text: 'OK' }]
      // );
      setFallbackStory();
    } finally {
      setLoading(false);
      if (refreshing) setRefreshing(false); // Ensure refreshing is turned off
    }
  };

  // Enhanced profile pic extraction using the same fields as UpdateProfileScreen
  const getSafeProfilePic = (userData) => {
    if (!userData) {
      console.log('getSafeProfilePic: No userData provided');
      return '';
    }
    
    console.log('getSafeProfilePic input:', {
      userId: userData?._id || 'Unknown ID',
      fullName: userData?.fullName,
      username: userData?.username,
      hasPhotoUrl: !!userData?.photoUrl,
      hasProfilePic: !!userData?.profilePic,
      hasAvatar: !!userData?.avatar,
      hasPhoto: !!userData?.photo
    });

    // Check all possible fields for profile picture (same as UpdateProfileScreen)
    const profilePic = userData.photoUrl || 
                      userData.profilePic || 
                      userData.avatar || 
                      userData.photo ||
                      userData.profileImageUrl ||
                      userData.avatarUrl ||
                      userData.image ||
                      '';

    console.log('getSafeProfilePic found raw:', profilePic);

    if (profilePic && typeof profilePic === 'string' && profilePic.trim() !== '') {
      const trimmedPic = profilePic.trim();

      // Handle different URL formats
      if (trimmedPic.startsWith('http://') || trimmedPic.startsWith('https://')) {
        console.log('getSafeProfilePic returning absolute URL:', trimmedPic);
        return trimmedPic;
      } else if (trimmedPic.startsWith('/')) {
        const fullUrl = `${BASE_URL}${trimmedPic}`;
        console.log('getSafeProfilePic returning relative URL converted:', fullUrl);
        return fullUrl;
      } else if (trimmedPic.startsWith('data:image')) {
        // Handle base64 images
        console.log('getSafeProfilePic returning base64 image');
        return trimmedPic;
      } else {
        // Try to construct full URL for relative paths without leading slash
        const fullUrl = `${BASE_URL}/${trimmedPic}`;
        console.log('getSafeProfilePic returning constructed URL:', fullUrl);
        return fullUrl;
      }
    }

    console.log('getSafeProfilePic returning empty string');
    return '';
  };

  // Enhanced username extraction using the same fields as UpdateProfileScreen
  const getSafeUsername = (userData) => {
    if (!userData) {
      console.log('getSafeUsername: No userData provided');
      return 'Unknown User';
    }

    console.log('getSafeUsername input:', {
      userId: userData?._id || 'Unknown ID',
      fullName: userData?.fullName,
      username: userData?.username,
      displayName: userData?.displayName,
      name: userData?.name,
      email: userData?.email
    });

    // Check all possible fields for user name (same as UpdateProfileScreen)
    const username = userData.fullName || 
                    userData.username || 
                    userData.displayName || 
                    userData.name ||
                    (userData.firstName && userData.lastName ? 
                      `${userData.firstName} ${userData.lastName}` : '') ||
                    userData.email?.split('@')[0] ||
                    userData.username ||
                    '';

    const result = username && typeof username === 'string' && username.trim() !== '' 
      ? username.trim() 
      : `User_${userData._id?.substring(0, 6) || 'unknown'}`;

    console.log('getSafeUsername result:', result);

    return result;
  };

  const setFallbackStory = () => {
    const fallbackUser = currentUser || { 
      fullName: 'You', 
      username: 'You', 
      profilePic: null 
    };

    setStories([{
      id: 'your_story',
      name: 'Your Story',
      img: getSafeProfilePic(fallbackUser),
      add: true,
      isCurrentUser: true,
      user: fallbackUser,
      hasStory: false,
      hasViewed: true,
      stories: [],
      storyCount: 0,
      isLive: false,
      liveStream: null,
      latestStoryTimestamp: null,
      liveStreamStartTime: null,
    }]);
  };

  // --- UPDATED handleStoryPress ---
  const handleStoryPress = (story) => {
    console.log('📱 Story pressed:', story.name, story.id);

    if (story.isCurrentUser) {
      // Check if current user is live (WebRTC stream)
      if (story.isLive && story.liveStream) {
        console.log('🔴 Navigating to CreateLiveStream for own stream management');
        navigation.navigate('CreateLiveStream');
      } else if (story.hasStory) {
        console.log('📖 Navigating to view own stories');
        // Navigate to view own stories
        navigation.navigate('StoryViewer', {
          stories: story.stories,
          currentIndex: 0,
          userName: 'Your Story',
          userAvatar: story.img,
          userId: currentUser?._id,
          isOwnStory: true
        });
      } else {
        console.log('➕ Navigating to create story');
        // Navigate to create story
        handleCreateStory();
      }
    } else {
      // Check if other user is live (WebRTC stream)
      if (story.isLive && story.liveStream) {
        console.log('📺 Navigating to LiveStreamViewer for stream:', story.liveStream.streamId);
        // FIXED: Ensure we have a valid streamId before navigating
        if (story.liveStream.streamId) {
          navigation.navigate('LiveStreamViewer', {
            streamId: story.liveStream.streamId,
          });
        } else {
          console.error('❌ No streamId found in liveStream object:', story.liveStream);
          Alert.alert('Error', 'Invalid stream ID. Cannot join stream.');
        }
      } else if (story.hasStory) {
        console.log('📖 Navigating to view other user stories');
        // Navigate to view other user's stories
        handleViewStory(story);
      } else {
        console.log('ℹ️ User has no stories and is not live');
      }
    }
  };

  const handleCreateStory = () => {
    navigation.navigate('CreateStory');
  };

  const handleViewStory = async (story) => {
    if (story.stories && story.stories.length > 0) {
      // Mark stories as viewed by calling the view API for the first story
      try {
        if (token) {
          const firstStoryId = story.stories[0]._id;
          await fetch(`${BASE_URL}/api/v1/stories/stories/${firstStoryId}/view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
          });
        }
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }

      navigation.navigate('StoryViewer', {
        stories: story.stories,
        currentIndex: 0,
        userName: story.name,
        userAvatar: story.img,
        userId: story.user._id,
        isOwnStory: false
      });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStoriesData();
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string' || name === 'Unknown User') return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];

    if (!name || typeof name !== 'string') return colors[0];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Enhanced renderStoryImage function
  const renderStoryImage = (story) => {
    // Determine border color based on story status and live state
    let borderColor = "#666666"; // Default gray
    let borderWidth = 2;

    if (story.isLive) {
      // Live streams get red border regardless of user
      borderColor = "#ff0000";
      borderWidth = 3;
    } else if (story.isCurrentUser) {
      if (story.hasStory) {
        borderColor = "#ed167e"; // Pink for own story
        borderWidth = 3;
      } else {
        borderColor = "#666666"; // Gray for no story
        borderWidth = 2;
      }
    } else if (story.hasStory) {
      if (!story.hasViewed) {
        borderColor = "#ed167e"; // Pink for unviewed
        borderWidth = 3;
      } else {
        borderColor = "#666666"; // Gray for viewed
        borderWidth = 2;
      }
    }

    // Check if we have a valid image URL
    const hasValidImage = story.img && typeof story.img === 'string' && story.img.trim() !== '';
    const imageUrl = hasValidImage ? story.img.trim() : '';

    console.log(`Rendering story image for ${story.name}:`, {
      hasValidImage,
      imageUrl,
      userId: story.id,
      isCurrentUser: story.isCurrentUser,
      isLive: story.isLive,
      originalImg: story.img
    });

    if (hasValidImage && imageUrl) {
      return (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            {
              borderColor: borderColor,
              borderWidth: borderWidth
            }
          ]}
          onError={(error) => {
            console.log('❌ Image load error for:', story.name, story.id, imageUrl, error.nativeEvent.error);
          }}
          onLoad={() => {
            console.log('✅ Image loaded successfully for:', story.name, story.id, imageUrl);
          }}
          // Add cache handling
          cache="force-cache"
        />
      );
    } else {
      // Fallback to colored circle with initials
      console.log(`Using fallback avatar for ${story.name} with color ${getAvatarColor(story.name)}`);
      return (
        <View style={[
          styles.image,
          styles.placeholderImage,
          {
            backgroundColor: getAvatarColor(story.name),
            borderColor: borderColor,
            borderWidth: borderWidth
          }
        ]}>
          <Text style={styles.placeholderText}>
            {getInitials(story.name)}
          </Text>
        </View>
      );
    }
  };

  // Always show add button for current user (unless live)
  const renderAddButton = (story) => {
    if (!story.isCurrentUser || story.isLive) return null; // Don't show add when live

    return (
      <TouchableOpacity style={styles.addButton} onPress={handleCreateStory}>
        <Text style={styles.addIcon}>+</Text>
      </TouchableOpacity>
    );
  };

  // Show live indicator and story count
  const renderIndicators = (story) => {
    return (
      <View style={styles.indicatorsContainer}>
        {/* Live indicator for WebRTC streams */}
        {story.isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveIcon} />
            <Text style={styles.liveText}>LIVE</Text>
            {story.liveStream?.viewersCount != null && story.liveStream?.viewersCount > 0 && (
              <Text style={styles.viewerCount}>{story.liveStream.viewersCount}</Text>
            )}
          </View>
        )}
        
        {/* Story count indicator */}
        {story.storyCount > 1 && !story.isLive && (
          <View style={styles.multipleStoriesIndicator}>
            <Text style={styles.storiesCount}>{story.storyCount}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#ed167e" />
        <Text style={styles.loadingText}>Loading stories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {stories.map((story) => (
          <TouchableOpacity
            key={story.id}
            style={styles.story}
            onPress={() => handleStoryPress(story)}
            activeOpacity={0.8}
          >
            <View style={styles.imageContainer}>
              {renderStoryImage(story)}
              {renderAddButton(story)}
              {renderIndicators(story)}
            </View>

            <Text style={[
              styles.name,
              story.isCurrentUser && styles.yourStoryName,
              story.isLive && styles.liveUserName // Special style for live users
            ]} numberOfLines={1}>
              {story.name}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Show message when only "Your Story" is available */}
        {stories.length === 1 && stories[0].isCurrentUser && !stories[0].hasStory && !stories[0].isLive && (
          <View style={styles.noStoriesContainer}>
            <Text style={styles.noStoriesText}>
              No stories from people you follow yet
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    paddingVertical: 12,
  },
  scrollView: {
    paddingVertical: 5,
  },
  contentContainer: {
    paddingHorizontal: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 25,
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#ffffff',
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '500',
  },
  story: {
    alignItems: "center",
    marginHorizontal: 6,
    width: 75,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  image: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: "#666666",
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#ed167e",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 20,
  },
  indicatorsContainer: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  // Live indicator styles (WebRTC)
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff0000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  liveIcon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  viewerCount: {
    color: '#fff',
    fontSize: 8,
    marginLeft: 2,
  },
  multipleStoriesIndicator: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#333',
  },
  storiesCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  name: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
    marginBottom: 2,
  },
  yourStoryName: {
    fontWeight: '600',
    color: '#ed167e',
  },
  // Live user name style (WebRTC)
  liveUserName: {
    color: '#ff0000',
    fontWeight: '600',
  },
  noStoriesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginLeft: 10,
  },
  noStoriesText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AllStories;