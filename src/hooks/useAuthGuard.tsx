import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UseAuthGuardOptions {
  requireAuth?: boolean;
  requireOnboarding?: boolean;
  redirectTo?: keyof RootStackParamList;
}

/**
 * Hook to protect routes with authentication and onboarding checks
 * @param options - Configuration options for the auth guard
 * @returns Auth state and user data
 */
export const useAuthGuard = (options: UseAuthGuardOptions = {}) => {
  const {
    requireAuth = true,
    requireOnboarding = false,
    redirectTo = 'Login'
  } = options;

  const navigation = useNavigation<NavigationProp>();
  const { 
    isAuthenticated, 
    isInitialized, 
    user, 
    isLoading,
    checkOnboardingStatus 
  } = useAuth();

  useEffect(() => {
    const checkAuthStatus = async () => {
      // Wait for auth initialization
      if (!isInitialized || isLoading) {
        return;
      }

      // Check authentication requirement
      if (requireAuth && !isAuthenticated) {
        console.log('Auth guard: Redirecting to login - not authenticated');
        navigation.reset({
          index: 0,
          routes: [{ name: redirectTo }],
        });
        return;
      }

      // Check onboarding requirement
      if (requireOnboarding && isAuthenticated && user) {
        try {
          const { completed } = await checkOnboardingStatus();
          if (!completed) {
            console.log('Auth guard: Redirecting to onboarding - not completed');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Gender', params: { userId: user._id } }],
            });
            return;
          }
        } catch (error) {
          console.error('Auth guard: Error checking onboarding status:', error);
        }
      }
    };

    checkAuthStatus();
  }, [
    isAuthenticated, 
    isInitialized, 
    user, 
    isLoading,
    requireAuth, 
    requireOnboarding, 
    redirectTo,
    navigation,
    checkOnboardingStatus
  ]);

  return {
    isAuthenticated,
    isInitialized,
    user,
    isLoading,
    isReady: isInitialized && !isLoading
  };
};

/**
 * Higher-order component to wrap screens with auth protection
 */
export const withAuthGuard = <T extends object>(
  Component: React.ComponentType<T>,
  options: UseAuthGuardOptions = {}
) => {
  return (props: T) => {
    const { isReady } = useAuthGuard(options);

    // Show loading state while checking auth
    if (!isReady) {
      return null; // Or return a loading component
    }

    return <Component {...props} />;
  };
};

/**
 * Hook specifically for screens that require completed onboarding
 */
export const useRequireOnboarding = () => {
  return useAuthGuard({
    requireAuth: true,
    requireOnboarding: true,
    redirectTo: 'Login'
  });
};

/**
 * Hook specifically for screens that require authentication but not onboarding
 */
export const useRequireAuth = () => {
  return useAuthGuard({
    requireAuth: true,
    requireOnboarding: false,
    redirectTo: 'Login'
  });
};

/**
 * Hook for public screens (no auth required)
 */
export const usePublicRoute = () => {
  return useAuthGuard({
    requireAuth: false,
    requireOnboarding: false
  });
};