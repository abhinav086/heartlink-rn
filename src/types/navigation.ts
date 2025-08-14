// types/navigation.ts
import { CallData } from '../utils/AgoraUtils';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  Gender: { userId: string };
  Questions: { userId: string; gender: 'Male' | 'Female' | 'Others'; step?: number };
  ProfileSetup: { userId: string; gender: 'Male' | 'Female' | 'Others'; answers: string[] };
  WalletScreen: undefined;
  HomeScreen: undefined;
  ExploreScreen: undefined;
  CreateScreen: undefined;
  SettingsScreen: undefined;
  OffersScreen: undefined;
  UserProfile: { userId: string; fromChat?: boolean; conversationId?: string };
  ChatScreen: undefined;
  ChatDetailScreen: {
    conversationId: string;
    receiverId: string;
    receiverName: string;
    receiverOnline?: boolean;
  };
  AudioCall: {
    callData: CallData;
    isOutgoing: boolean;
  };
  VideoCall: {
    callData: CallData;
    isOutgoing: boolean;
  };
};