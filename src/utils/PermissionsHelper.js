import { PermissionsAndroid, Platform, AppState } from "react-native";

export const requestStoragePermission = async () => {
  try {
    if (Platform.OS === "android") {
      if (AppState.currentState !== "active") {
        console.warn("App is not active, skipping permission request.");
        return false;
      }

      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);

      return (
        granted["android.permission.READ_MEDIA_IMAGES"] === PermissionsAndroid.RESULTS.GRANTED ||
        granted["android.permission.READ_EXTERNAL_STORAGE"] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true;
  } catch (err) {
    console.warn("Storage permission error:", err);
    return false;
  }
};

export const requestCameraPermission = async () => {
  try {
    if (Platform.OS === "android") {
      if (AppState.currentState !== "active") {
        console.warn("App is not active, skipping camera permission request.");
        return false;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch (err) {
    console.warn("Camera permission error:", err);
    return false;
  }
};
