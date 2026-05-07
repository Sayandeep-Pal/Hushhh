import { Alert } from 'react-native';

export interface AppError {
  message: string;
  type: 'NETWORK' | 'SERVER' | 'AUTH' | 'UNKNOWN';
  originalError?: any;
}

/**
 * Categorizes and formats errors for user-friendly display.
 */
export const handleError = (error: any, title: string = 'Error'): AppError => {
  let appError: AppError = {
    message: 'An unexpected error occurred.',
    type: 'UNKNOWN',
    originalError: error,
  };

  if (error.response) {
    // Server responded with a status code outside the 2xx range
    const status = error.response.status;
    const data = error.response.data;

    if (status === 401 || status === 403) {
      appError.type = 'AUTH';
      appError.message = 'Your session has expired. Please log in again.';
    } else if (status >= 500) {
      appError.type = 'SERVER';
      appError.message = 'The server is having trouble. Please try again later.';
    } else {
      appError.type = 'SERVER';
      appError.message = data?.error || 'Something went wrong on our end.';
    }
  } else if (error.request) {
    // Request was made but no response was received
    appError.type = 'NETWORK';
    appError.message = 'Network error. Please check your internet connection.';
  } else if (error.message) {
    appError.message = error.message;
  }

  Alert.alert(title, appError.message);
  return appError;
};

/**
 * Returns a short error message for inline display.
 */
export const getErrorMessage = (error: any): string => {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.request) return 'Network unreachable.';
  return error.message || 'An error occurred.';
};
