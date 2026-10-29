import { useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { color } from '@klyr/tokens';
import { sora } from './ui';

type Photo = { url: string; alt: string };

/** Swipe left and right through a listing's photos, with dots and a "2 / 4" count. */
export function PhotoStrip({ photos, address, sample, onPress }: { photos: Photo[]; address: string; sample: boolean; onPress?: () => void }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const height = width * (2 / 3);

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ backgroundColor: color.surfaceGrouped, height: height || undefined, aspectRatio: width ? undefined : 3 / 2 }}
      accessibilityLabel={`Photos of ${address}`}>
      {width > 0 && photos.length > 0 && (
        <FlatList
          data={photos}
          keyExtractor={(p, i) => p.url + i}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          // Let the parent vertical scroll keep working while swiping sideways.
          nestedScrollEnabled
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          onScroll={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={64}
          renderItem={({ item, index: i }) => {
            const img = <Image source={{ uri: item.url }} style={{ width, height }} resizeMode="cover"
              accessible accessibilityLabel={item.alt || `Photo ${i + 1} of ${photos.length}`} />;
            // On a search card a tap opens the listing; a swipe still pages the photos.
            return onPress ? <Pressable onPress={onPress} accessible={false}>{img}</Pressable> : img;
          }}
        />
      )}
      {width > 0 && !photos.length && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ ...sora(), color: color.textSecondary }}>No photos yet</Text></View>
      )}
      {photos.length > 1 && (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            {photos.map((_, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,.55)' }} />)}
          </View>
          <Pill style={{ right: 10, bottom: 10 }}>{`${index + 1} / ${photos.length}`}</Pill>
        </>
      )}
      {sample && <Pill style={{ left: 10, bottom: 10 }}>Sample photos</Pill>}
    </View>
  );
}

function Pill({ children, style }: { children: string; style: { left?: number; right?: number; bottom?: number } }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', ...(style.bottom == null ? { top: 10 } : {}), borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,.55)', ...style }}>
      <Text style={{ ...sora(600), fontSize: 12, color: '#fff' }}>{children}</Text>
    </View>
  );
}
