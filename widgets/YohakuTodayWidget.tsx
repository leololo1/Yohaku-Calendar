import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type YohakuTodayWidgetEvent = {
  title: string;
  time: string;
};

export type YohakuTodayWidgetProps = {
  dateLabel?: string;
  events?: YohakuTodayWidgetEvent[];
  totalCount?: number;
};

function normalizeProps(props: YohakuTodayWidgetProps) {
  const events = Array.isArray(props.events) ? props.events : [];

  return {
    dateLabel: props.dateLabel || 'Today',
    events,
    totalCount: typeof props.totalCount === 'number' ? props.totalCount : events.length,
  };
}

const EventRow = ({ event }: { event: YohakuTodayWidgetEvent }) => (
  <HStack modifiers={[padding({ top: 3, bottom: 3 })]}>
    <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle('#777777')]}>{event.time}</Text>
    <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#222222'), lineLimit(1)]}>{event.title}</Text>
  </HStack>
);

const EmptyState = () => (
  <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle('#AAAAAA')]}>予定はありません</Text>
);

const YohakuTodayWidget = (props: YohakuTodayWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const { dateLabel, events, totalCount } = normalizeProps(props);
  const rows = events.slice(0, environment.widgetFamily === 'systemSmall' ? 2 : 3);
  const remainingCount = Math.max(0, totalCount - rows.length);

  return (
    <VStack spacing={8} modifiers={[padding({ top: 16, bottom: 16, leading: 16, trailing: 16 })]}>
      <HStack>
        <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle('#222222')]}>{dateLabel}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#777777')]}>{totalCount}件</Text>
      </HStack>
      {rows.length === 0 ? <EmptyState /> : rows.map((event, index) => <EventRow key={`${event.time}-${event.title}-${index}`} event={event} />)}
      {remainingCount > 0 ? (
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#777777')]}>ほか{remainingCount}件</Text>
      ) : null}
    </VStack>
  );
};

const Widget = createWidget<YohakuTodayWidgetProps>('YohakuTodayWidget', YohakuTodayWidget);

Widget.updateSnapshot({
  dateLabel: 'Today',
  events: [],
  totalCount: 0,
});

export default Widget;
