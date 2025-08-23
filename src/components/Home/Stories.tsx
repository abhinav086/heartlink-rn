// AllStories.js (OPTIMIZED VERSION - Fixed Double Rendering)
import React, { useState, useEffect, useCallback, useRef } from "react";
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

const AllStories = ({ disableRefresh = false }) => {
  const navigation = useNavigation();
  const { user: currentUser, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // FIXED: Better tracking to prevent double calls
  const hasInitiallyLoaded = useRef(false);
  const isLoadingRef = useRef(false);
  const lastFetchTimestamp = useRef(0);
  
  // FIXED: Stable refs for auth data to prevent unnecessary re-runs
  const currentUserRef = useRef(currentUser);
  const tokenRef = useRef(token);
  
  // Update refs when auth data changes
  useEffect(() => {
    currentUserRef.current = currentUser;
    tokenRef.current = token;
  }, [currentUser, token]);

  // FIXED: Remove dependencies that cause recreation - use refs instead
  const fetchStoriesData = useCallback(async (forceRefresh = false) => {
    // NEW: Debouncing - prevent calls within 1 second of each other
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTimestamp.current) < 1000) {
      console.log('🚫 fetchStoriesData debounced - too soon since last call');
      return;
    }

    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('🚫 fetchStoriesData already in progress, skipping');
      return;
    }

    try {
      isLoadingRef.current = true;
      lastFetchTimestamp.current = now;
      
      // FIXED: Batch state updates and only update when necessary
      const shouldShowLoading = !hasInitiallyLoaded.current;
      const isRefreshAction = refreshing;
      
      // Single state update for loading
      if (shouldShowLoading) {
        setLoading(true);
      }

      // Get current auth values from refs
      const currentToken = tokenRef.current;
      const currentUserData = currentUserRef.current;

      if (!currentToken) {
        console.log('No token found');
        setFallbackStory();
        return;
      }

      if (!currentUserData) {
        console.log('No current user found');
        setFallbackStory();
        return;
      }

      console.log('=== DEBUG: Current User Data ===');
      console.log('Current User ID:', currentUserData?._id);
      console.log('Current User Name:', currentUserData?.fullName || currentUserData?.username);
      console.log('Current User Profile Pic:', getSafeProfilePic(currentUserData));
      console.log('====================');

      // Fetch stories from backend
      const storiesResponse = await fetch(`${BASE_URL}/api/v1/stories/stories`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!storiesResponse.ok) {
        throw new Error(`HTTP ${storiesResponse.status}: ${storiesResponse.statusText}`);
      }

      const storiesData = await storiesResponse.json();
      console.log('Stories API Response:', storiesData);

      // FIXED: Fetch active live streams using the correct endpoint
      let liveStreamsData = [];
      try {
        console.log('🔴 Fetching active live streams...');
        const liveStreamsResponse = await fetch(`${BASE_URL}/api/v1/live/active?limit=50`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
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

      // Find current user's stream from the active streams list
      let currentUserLiveStreamData = null;
      if (liveStreamsData.length > 0 && currentUserData?._id) {
        currentUserLiveStreamData = liveStreamsData.find(stream => 
          stream.streamer?._id === currentUserData._id
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
        userStories => userStories.user._id === currentUserData?._id
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
      if (userLiveStreamMap[currentUserData._id]) {
        currentUserIsLive = true;
        currentUserLiveStream = userLiveStreamMap[currentUserData._id];
        console.log('Current user is LIVE:', currentUserLiveStream);
      }

      const currentUserProfilePic = getSafeProfilePic(currentUserData);

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
        user: currentUserData,
        hasStory: currentUserHasStory,
        hasViewed: true,
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
        userStories => userStories.user._id !== currentUserData?._id
      );

      // Also check for users who are live but don't have stories in the fetched list
      const usersWithStories = new Set(fetchedStories.map(s => s.user._id));

      // Add live streamers who don't have stories
      for (const [streamerId, streamData] of Object.entries(userLiveStreamMap)) {
        if (streamerId !== currentUserData._id && !usersWithStories.has(streamerId)) {
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
          
          try {
            console.log(`Fetching detailed profile for user ${userId}...`);
            const userProfileResponse = await fetch(`${BASE_URL}/api/v1/users/user/${userId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${currentToken}`,
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

          const hasViewedAllStories = userStoriesList.length > 0 ?
            userStoriesList.every(story => story.hasViewed === true) : true;

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
            isLive: isLive,
            liveStream: liveStream,
            latestStoryTimestamp: latestStoryTimestamp,
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
            isLive: isLive,
            liveStream: liveStream,
            latestStoryTimestamp: latestStoryTimestamp,
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

      // FIXED: Batch all state updates into a single update
      hasInitiallyLoaded.current = true;
      
      // Single batched state update
      if (isRefreshAction) {
        setRefreshing(false);
      }
      if (shouldShowLoading) {
        setLoading(false);
      }
      setStories(sortedStories);

    } catch (error) {
      console.error('Error fetching stories:', error);
      setFallbackStory();
      hasInitiallyLoaded.current = true;
    } finally {
      // FIXED: Clean final state update
      isLoadingRef.current = false;
      if (refreshing) {
        setRefreshing(false);
      }
      if (loading) {
        setLoading(false);
      }
    }
  }, []); // FIXED: No dependencies - use refs for auth data

  // FIXED: Stable initial load effect with minimal dependencies
  useEffect(() => {
    // Only run if we have the required auth data and haven't loaded yet
    if (!hasInitiallyLoaded.current && token && currentUser && !isLoadingRef.current) {
      console.log('🚀 Initial stories load');
      fetchStoriesData();
    }
  }, [token, currentUser]); // FIXED: Remove fetchStoriesData dependency

  // FIXED: Socket listeners with better debouncing
  useEffect(() => {
    if (socket && isConnected && hasInitiallyLoaded.current) {
      console.log('🔌 Setting up socket listeners');

      const handleStreamWentLive = (streamData) => {
        console.log('🔴 Live stream went live (socket):', streamData);
        // FIXED: Debounced refresh to prevent rapid calls
        setTimeout(() => {
          if (!isLoadingRef.current) {
            fetchStoriesData(true); // Force refresh for real-time updates
          }
        }, 500); // 500ms delay
      };

      const handleStreamEnded = (streamData) => {
        console.log('⚫ Live stream ended (socket):', streamData);
        // FIXED: Use functional state update to prevent unnecessary re-renders
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
        // FIXED: Use functional state update
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
      socket.on('stream:viewer_update', handleViewerUpdate);

      // Cleanup listeners on unmount or socket change
      return () => {
        console.log('🔌 Cleaning up socket listeners');
        socket.off('stream:went_live', handleStreamWentLive);
        socket.off('stream:ended', handleStreamEnded);
        socket.off('stream:viewer_count', handleViewerUpdate);
        socket.off('stream:viewer_update', handleViewerUpdate);
      };
    }
  }, [socket, isConnected]); // FIXED: Keep minimal dependencies

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

      if (trimmedPic.startsWith('http://') || trimmedPic.startsWith('https://')) {
        console.log('getSafeProfilePic returning absolute URL:', trimmedPic);
        return trimmedPic;
      } else if (trimmedPic.startsWith('/')) {
        const fullUrl = `${BASE_URL}${trimmedPic}`;
        console.log('getSafeProfilePic returning relative URL converted:', fullUrl);
        return fullUrl;
      } else if (trimmedPic.startsWith('data:image')) {
        console.log('getSafeProfilePic returning base64 image');
        return trimmedPic;
      } else {
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

  // FIXED: Use useCallback to prevent recreation and optimize deps
  const setFallbackStory = useCallback(() => {
    const fallbackUser = currentUserRef.current || { 
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
  }, []); // No dependencies

  const handleStoryPress = (story) => {
    console.log('📱 Story pressed:', story.name, story.id);

    if (story.isCurrentUser) {
      if (story.isLive && story.liveStream) {
        console.log('🔴 Navigating to CreateLiveStream for own stream management');
        navigation.navigate('CreateLiveStream');
      } else if (story.hasStory) {
        console.log('📖 Navigating to view own stories');
        navigation.navigate('StoryViewer', {
          stories: story.stories,
          currentIndex: 0,
          userName: 'Your Story',
          userAvatar: story.img,
          userId: currentUserRef.current?._id,
          isOwnStory: true
        });
      } else {
        console.log('➕ Navigating to create story');
        handleCreateStory();
      }
    } else {
      if (story.isLive && story.liveStream) {
        console.log('📺 Navigating to LiveStreamViewer for stream:', story.liveStream.streamId);
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
      try {
        if (tokenRef.current) {
          const firstStoryId = story.stories[0]._id;
          await fetch(`${BASE_URL}/api/v1/stories/stories/${firstStoryId}/view`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenRef.current}`,
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

  // FIXED: Optimized onRefresh with stable callback
  const onRefresh = useCallback(() => {
    if (disableRefresh) {
      console.log('🚫 Refresh disabled for this Stories component');
      return;
    }
    console.log('🔄 Manual refresh triggered');
    setRefreshing(true);
    fetchStoriesData(true); // Force refresh
  }, [disableRefresh]); // FIXED: Remove fetchStoriesData dependency

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
    let borderColor = "#666666";
    let borderWidth = 2;

    if (story.isLive) {
      borderColor = "#ff0000";
      borderWidth = 3;
    } else if (story.isCurrentUser) {
      if (story.hasStory) {
        borderColor = "#ed167e";
        borderWidth = 3;
      } else {
        borderColor = "#666666";
        borderWidth = 2;
      }
    } else if (story.hasStory) {
      if (!story.hasViewed) {
        borderColor = "#ed167e";
        borderWidth = 3;
      } else {
        borderColor = "#666666";
        borderWidth = 2;
      }
    }

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
          cache="force-cache"
        />
      );
    } else {
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

  const renderAddButton = (story) => {
    if (!story.isCurrentUser || story.isLive) return null;

    return (
      <TouchableOpacity style={styles.addButton} onPress={handleCreateStory}>
        <Text style={styles.addIcon}>+</Text>
      </TouchableOpacity>
    );
  };

  const renderIndicators = (story) => {
    return (
      <View style={styles.indicatorsContainer}>
        {story.isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveIcon} />
            <Text style={styles.liveText}>LIVE</Text>
            {story.liveStream?.viewersCount != null && story.liveStream?.viewersCount > 0 && (
              <Text style={styles.viewerCount}>{story.liveStream.viewersCount}</Text>
            )}
          </View>
        )}
        
        {story.storyCount > 1 && !story.isLive && (
          <View style={styles.multipleStoriesIndicator}>
            <Text style={styles.storiesCount}>{story.storyCount}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading && !hasInitiallyLoaded.current) {
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
          !disableRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
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
              story.isLive && styles.liveUserName
            ]} numberOfLines={1}>
              {story.name}
            </Text>
          </TouchableOpacity>
        ))}

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