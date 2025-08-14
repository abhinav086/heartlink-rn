import React, { useState, useCallback } from "react";
import { FlatList, RefreshControl } from "react-native";
import Post from "./Post";
import postsData from "../../data/postsData";

// Debug function to check data structure
const analyzePostsData = (posts) => {
  console.log('=== POSTS DATA ANALYSIS ===');
  console.log('Total posts:', posts.length);
  
  if (posts.length > 0) {
    const firstPost = posts[0];
    console.log('First post structure:', Object.keys(firstPost));
    console.log('Date fields found:', {
      createdAt: firstPost.createdAt,
      timestamp: firstPost.timestamp,
      timeAgo: firstPost.timeAgo,
      date: firstPost.date,
      created: firstPost.created
    });
  }
  
  // Check how many posts have valid dates
  const postsWithDates = posts.filter(post => 
    post.createdAt || post.timestamp || post.date || post.created
  );
  console.log('Posts with date fields:', postsWithDates.length);
  console.log('=== END ANALYSIS ===');
};

// Enhanced data preparation - adds timestamps if missing
const preparePostsData = (posts) => {
  console.log('📊 Preparing posts data...');
  
  return posts.map((post, index) => {
    // Try to find existing date field
    let postDate = null;
    
    if (post.createdAt) {
      postDate = new Date(post.createdAt);
    } else if (post.timestamp) {
      postDate = new Date(post.timestamp);
    } else if (post.date) {
      postDate = new Date(post.date);
    } else if (post.created) {
      postDate = new Date(post.created);
    }
    
    // If no valid date found, create simulated timestamps
    if (!postDate || isNaN(postDate.getTime())) {
      // Simulate recent posts - newer posts get more recent timestamps
      const hoursAgo = Math.floor(Math.random() * (index + 1) * 2); // 0 to 2*(index+1) hours ago
      postDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      
      console.log(`📅 Generated timestamp for post ${post.id || index}: ${hoursAgo} hours ago`);
    }
    
    return {
      ...post,
      createdAt: postDate.toISOString(),
      timestamp: postDate.getTime(),
      // Keep original timeAgo if it exists
      timeAgo: post.timeAgo || `${Math.floor((Date.now() - postDate.getTime()) / (60 * 60 * 1000))}h ago`
    };
  });
};

// Smart weighted shuffle with better logic
const smartWeightedShuffle = (posts) => {
  console.log('🔀 Starting smart weighted shuffle...');
  
  // Prepare data with proper timestamps
  const preparedPosts = preparePostsData(posts);
  
  // Sort by timestamp (newest first)
  const sortedPosts = [...preparedPosts].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeB - timeA; // Newest first
  });
  
  console.log('📈 Posts sorted by date:', sortedPosts.slice(0, 3).map(p => ({
    id: p.id,
    timeAgo: p.timeAgo,
    createdAt: p.createdAt
  })));
  
  const now = Date.now();
  const result = [];
  const remaining = [...sortedPosts];
  
  while (remaining.length > 0) {
    const weights = remaining.map((post, index) => {
      const postTime = new Date(post.createdAt).getTime();
      const hoursAgo = (now - postTime) / (1000 * 60 * 60);
      
      // Recent posts (0-6 hours) get highest weight
      let recencyWeight = 100;
      if (hoursAgo <= 6) {
        recencyWeight = 200;
      } else if (hoursAgo <= 24) {
        recencyWeight = 150;
      } else if (hoursAgo <= 72) {
        recencyWeight = 100;
      } else {
        recencyWeight = 50;
      }
      
      // Position in remaining array (earlier = higher weight)
      const positionWeight = Math.max(10, remaining.length - index);
      
      // Random factor for variability
      const randomFactor = Math.random() * 50 + 25; // 25-75
      
      const finalWeight = recencyWeight * positionWeight * randomFactor;
      
      if (index < 5) { // Debug first 5
        console.log(`🎯 Post ${post.id}: ${hoursAgo.toFixed(1)}h ago, recency:${recencyWeight}, position:${positionWeight}, final:${finalWeight.toFixed(0)}`);
      }
      
      return finalWeight;
    });
    
    // Select based on weight
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }
    
    result.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }
  
  console.log('✅ Shuffle complete. First 5 results:', result.slice(0, 5).map(p => ({
    id: p.id,
    timeAgo: p.timeAgo
  })));
  
  return result;
};

// Simple recency-based shuffle (alternative approach)
const recencyBasedShuffle = (posts) => {
  console.log('📊 Using recency-based shuffle...');
  
  const preparedPosts = preparePostsData(posts);
  const now = Date.now();
  
  // Group posts by time periods
  const groups = {
    veryRecent: [], // 0-6 hours
    recent: [],     // 6-24 hours  
    older: [],      // 24+ hours
  };
  
  preparedPosts.forEach(post => {
    const postTime = new Date(post.createdAt).getTime();
    const hoursAgo = (now - postTime) / (1000 * 60 * 60);
    
    if (hoursAgo <= 6) {
      groups.veryRecent.push(post);
    } else if (hoursAgo <= 24) {
      groups.recent.push(post);
    } else {
      groups.older.push(post);
    }
  });
  
  console.log('📈 Groups:', {
    veryRecent: groups.veryRecent.length,
    recent: groups.recent.length,
    older: groups.older.length
  });
  
  // Shuffle each group
  const shuffleArray = (arr) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  // Interleave the groups with bias toward recent
  const result = [];
  const shuffledGroups = {
    veryRecent: shuffleArray(groups.veryRecent),
    recent: shuffleArray(groups.recent),
    older: shuffleArray(groups.older)
  };
  
  // Distribution: 60% very recent, 30% recent, 10% older (approximately)
  let vIdx = 0, rIdx = 0, oIdx = 0;
  
  while (vIdx < shuffledGroups.veryRecent.length || 
         rIdx < shuffledGroups.recent.length || 
         oIdx < shuffledGroups.older.length) {
    
    const rand = Math.random();
    
    if (rand < 0.6 && vIdx < shuffledGroups.veryRecent.length) {
      result.push(shuffledGroups.veryRecent[vIdx++]);
    } else if (rand < 0.9 && rIdx < shuffledGroups.recent.length) {
      result.push(shuffledGroups.recent[rIdx++]);
    } else if (oIdx < shuffledGroups.older.length) {
      result.push(shuffledGroups.older[oIdx++]);
    } else if (rIdx < shuffledGroups.recent.length) {
      result.push(shuffledGroups.recent[rIdx++]);
    } else if (vIdx < shuffledGroups.veryRecent.length) {
      result.push(shuffledGroups.veryRecent[vIdx++]);
    }
  }
  
  console.log('✅ Recency shuffle complete. First 5:', result.slice(0, 5).map(p => ({
    id: p.id,
    timeAgo: p.timeAgo
  })));
  
  return result;
};

// Standard Fisher-Yates shuffle
const standardShuffle = (posts) => {
  console.log('🔀 Using standard shuffle...');
  const shuffled = [...posts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const PostList = ({ shuffleMode = "smart" }) => {
  // Analyze data on component mount
  React.useEffect(() => {
    analyzePostsData(postsData);
  }, []);

  const [posts, setPosts] = useState(() => {
    console.log('🎯 Initial shuffle mode:', shuffleMode);
    
    switch (shuffleMode) {
      case "smart":
        return smartWeightedShuffle(postsData);
      case "recency":
        return recencyBasedShuffle(postsData);
      case "standard":
        return standardShuffle(postsData);
      default:
        return smartWeightedShuffle(postsData);
    }
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const onRefresh = useCallback(() => {
    console.log(`🔄 REFRESH #${refreshCount + 1} - Mode: ${shuffleMode}`);
    setRefreshing(true);
    
    setTimeout(() => {
      let newShuffledPosts;
      
      switch (shuffleMode) {
        case "smart":
          newShuffledPosts = smartWeightedShuffle(postsData);
          break;
        case "recency":
          newShuffledPosts = recencyBasedShuffle(postsData);
          break;
        case "standard":
          newShuffledPosts = standardShuffle(postsData);
          break;
        default:
          newShuffledPosts = smartWeightedShuffle(postsData);
      }
      
      setPosts(newShuffledPosts);
      setRefreshCount(prev => prev + 1);
      setRefreshing(false);
      
      console.log('✅ Refresh complete');
    }, 800);
  }, [shuffleMode, refreshCount]);

  return (
    <FlatList
      data={posts}
      keyExtractor={(item, index) => `${item.id || index}-${refreshCount}-${Math.random()}`}
      renderItem={({ item }) => <Post data={item} />}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={15}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#9b59b6"]}
          tintColor="#9b59b6"
        />
      }
      extraData={`${refreshCount}-${posts.length}`}
    />
  );
};

export default PostList;