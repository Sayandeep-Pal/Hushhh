import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B88B', '#52C7A1', '#FF85A2', '#6C5CE7', '#A29BFE', '#74B9FF', '#81ECEC', '#55EFC4'
];

const stylesList = [
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral', 'big-ears',
  'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral', 'croodles',
  'croodles-neutral', 'fun-emoji', 'icons', 'identicon', 'initials', 'lorelei',
  'micah', 'miniavs', 'notionists', 'notionists-neutral', 'personas',
  'pixel-art', 'pixel-art-neutral', 'rings', 'shapes', 'thumbs', 'open-peeps'
];

export const getAvatarData = (name: string, seedOverride?: string) => {
  const seed = seedOverride || name.trim();
  
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const absHash = Math.abs(hash);
  const color = colors[absHash % colors.length];
  const styleName = stylesList[absHash % stylesList.length];
  
  return { seed, color, styleName };
};

export const Avatar = ({ name, seed, size = 50, style: containerStyle }: { name: string, seed?: string, size?: number, style?: any }) => {
  const { seed: finalSeed, color, styleName } = useMemo(() => getAvatarData(name, seed), [name, seed]);

  const avatarUrl = useMemo(() => {
    return `https://api.dicebear.com/9.x/${styleName}/png?seed=${encodeURIComponent(finalSeed)}&size=${size * 2}&scale=80`;
  }, [finalSeed, styleName, size]);

  return (
    <View style={[
      { 
        width: size, 
        height: size, 
        borderRadius: size * 0.35, 
        backgroundColor: color, 
        overflow: 'hidden', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }, 
      containerStyle
    ]}>
      <Image 
        source={{ uri: avatarUrl }} 
        style={{ width: '100%', height: '100%' }}
        fadeDuration={0}
      />
    </View>
  );
};
