import { View, Text } from 'react-native';
import { styles } from './styles';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Your dashboard</Text>
    </View>
  );
}
