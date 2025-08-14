import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  SafeAreaView
} from "react-native";
import ExploreHeader from "../../components/Explore/ExploreHeader";
import MasonryGrid from "../../components/Explore/MasonryGrid";
import { useAuth } from "../../context/AuthContext";
import BASE_URL from "../../config/config";

const ExploreScreen = () => {
  const { token } = useAuth();
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const API_LIMIT = 15; // Load 15 images at a time as requested
  const MIN_SIMILARITY = 1;

  const fetchExploreImages = useCallback(async (pageNumber, isRefresh = false) => {
    if (!token) {
      setError("Authentication required to view explore content.");
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    // Set appropriate loading state
    if (pageNumber === 1 || isRefresh) {
      setLoading(true);
      if (isRefresh) {
        setImages([]); // Clear images for refresh
        setPage(1);
        setHasMore(true);
      }
    } else {
      setLoadingMore(true);
    }
    
    setError(null);

    try {
      // Build URL with proper pagination parameters
      const url = `${BASE_URL}/api/v1/users/explore/images?page=${pageNumber}&limit=${API_LIMIT}&minSimilarity=${MIN_SIMILARITY}`;
      
      console.log('Fetching explore images from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      console.log('API Response:', result);

      if (response.ok && result.success) {
        const newExploreItems = result.data.posts.map(post => ({
          id: post._id,
          imageUrl: post.mainImage, // Backend sets this property
          imageCount: post.imageCount || 1,
          isLikedByCurrentUser: post.isLikedByCurrentUser || false,
          userSimilarityScore: post.userSimilarityScore || 0,
          author: post.author,
          ...post // Spread the rest of the post data
        }));

        console.log(`Fetched ${newExploreItems.length} new images for page ${pageNumber}`);

        setImages(prevImages => {
          if (pageNumber === 1 || isRefresh) {
            return newExploreItems;
          } else {
            // Filter out duplicates based on ID
            const uniqueNewItems = newExploreItems.filter(
              newItem => !prevImages.some(existingItem => existingItem.id === newItem.id)
            );
            return [...prevImages, ...uniqueNewItems];
          }
        });

        // Update pagination status
        const pagination = result.data.pagination;
        if (pagination) {
          setHasMore(pagination.hasNext);
          setPage(pagination.currentPage);
        } else {
          // Fallback if pagination object is not available
          setHasMore(newExploreItems.length === API_LIMIT);
          setPage(pageNumber);
        }

        console.log(`Page ${pageNumber} loaded. Has more: ${pagination?.hasNext || newExploreItems.length === API_LIMIT}`);
      } else {
        // Handle API errors
        const errorMessage = result.message || 'Failed to fetch explore images.';
        setError(errorMessage);
        setHasMore(false);
        console.error('API Error:', errorMessage);
      }
    } catch (e) {
      console.error('Network error fetching explore images:', e);
      setError("Failed to load content. Please check your internet connection and try again.");
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, API_LIMIT, MIN_SIMILARITY]);

  // Initial load when component mounts
  useEffect(() => {
    fetchExploreImages(1);
  }, [fetchExploreImages]);

  // Function to load more images when reaching bottom
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      console.log(`Loading more images - next page: ${page + 1}`);
      fetchExploreImages(page + 1);
    }
  }, [loadingMore, hasMore, loading, page, fetchExploreImages]);

  // Function to refresh the feed
  const handleRefresh = useCallback(() => {
    console.log('Refreshing explore feed...');
    fetchExploreImages(1, true);
  }, [fetchExploreImages]);

  // Render footer loading indicator
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#ed167e" />
        <Text style={styles.loadingMoreText}>Loading more content...</Text>
      </View>
    );
  };

  // Render individual item
  const renderItem = useCallback(({ item, index }) => {
    return (
      <MasonryGrid 
        item={item} 
        index={index}
        onPress={() => {
          // Handle image press if needed
          console.log('Image pressed:', item.id);
        }}
      />
    );
  }, []);

  // Show full-screen loader for initial load
  if (loading && images.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#ed167e" />
        <Text style={styles.loadingText}>Loading explore feed...</Text>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && images.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Show empty state
  if (!loading && images.length === 0 && !error) {
    return (
      <View style={styles.container}>
        <ExploreHeader />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No explore content available at the moment.</Text>
          <Text style={styles.emptySubText}>Try updating your preferences or check back later!</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Refresh Feed</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main content display
  return (
    <View style={styles.container}>
      <ExploreHeader />
      <FlatList
        data={images}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3} // Trigger when 30% from bottom
        onRefresh={handleRefresh}
        refreshing={loading && images.length > 0}
        ListFooterComponent={renderFooter}
        removeClippedSubviews={true} // Performance optimization
        maxToRenderPerBatch={10} // Render 10 items per batch
        updateCellsBatchingPeriod={50} // Update every 50ms
        windowSize={10} // Keep 10 screens worth of items in memory
        getItemLayout={null} // Let FlatList calculate layout for masonry
        contentContainerStyle={images.length === 0 ? styles.emptyFlatList : null}
      />
      
      {/* Show error message overlay if there's an error but we still have images */}
      {error && images.length > 0 && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorOverlayText}>{error}</Text>
          <TouchableOpacity style={styles.retryButtonSmall} onPress={handleRefresh}>
            <Text style={styles.retryButtonTextSmall}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  loadingMoreText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 8,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButtonSmall: {
    backgroundColor: '#ed167e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  retryButtonTextSmall: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubText: {
    color: '#777',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyFlatList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  errorOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  errorOverlayText: {
    color: '#ff4757',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ExploreScreen;