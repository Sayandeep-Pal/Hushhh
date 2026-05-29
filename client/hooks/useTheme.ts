import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';

export function useTheme() {
  const theme = useColorScheme() ?? 'light';
  return Colors[theme];
}
