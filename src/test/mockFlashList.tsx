import { forwardRef, useImperativeHandle } from 'react';
import { Pressable, Text, View } from 'react-native';

export const FlashList = forwardRef(function MockFlashList(
  {
    data = [],
    renderItem,
    ListEmptyComponent,
    ListHeaderComponent,
    ListFooterComponent,
    onEndReached,
    onStartReached
  }: Record<string, any>,
  ref
) {
  useImperativeHandle(ref, () => ({
    scrollToEnd: jest.fn(),
    scrollToOffset: jest.fn()
  }));

  const renderComponent = (component: any) => {
    if (!component) return null;
    return typeof component === 'function' ? component() : component;
  };

  return (
    <View testID="flash-list">
      {renderComponent(ListHeaderComponent)}
      {data.length
        ? data.map((item: any, index: number) => (
            <View key={item.id ?? index}>{renderItem({ item, index })}</View>
          ))
        : renderComponent(ListEmptyComponent)}
      {renderComponent(ListFooterComponent)}
      {onStartReached ? (
        <Pressable accessibilityRole="button" onPress={onStartReached}>
          <Text>Load older</Text>
        </Pressable>
      ) : null}
      {onEndReached ? (
        <Pressable accessibilityRole="button" onPress={onEndReached}>
          <Text>Load more</Text>
        </Pressable>
      ) : null}
    </View>
  );
});
