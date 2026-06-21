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

type YohakuTodayWidgetRenderer = (
  props: YohakuTodayWidgetProps,
  environment: WidgetEnvironment
) => React.JSX.Element;

const yohakuTodayWidgetLayout = `function(props, environment) {
  var events = Array.isArray(props.events) ? props.events : [];
  var dateLabel = props.dateLabel || 'Today';
  var totalCount = typeof props.totalCount === 'number' ? props.totalCount : events.length;
  var rows = events.slice(0, environment && environment.widgetFamily === 'systemSmall' ? 2 : 3);
  var remainingCount = Math.max(0, totalCount - rows.length);
  var children = [
    _jsxs(HStack, {
      children: [
        _jsx(Text, {
          modifiers: [font({ size: 17, weight: 'semibold' }), foregroundStyle('#222222')],
          children: dateLabel
        }),
        _jsx(Spacer, {}),
        _jsxs(Text, {
          modifiers: [font({ size: 12, weight: 'medium' }), foregroundStyle('#777777')],
          children: [totalCount, '\\u4EF6']
        })
      ]
    })
  ];

  if (rows.length === 0) {
    children.push(
      _jsx(Text, {
        modifiers: [font({ size: 14, weight: 'medium' }), foregroundStyle('#AAAAAA')],
        children: '\\u4E88\\u5B9A\\u306F\\u3042\\u308A\\u307E\\u305B\\u3093'
      })
    );
  } else {
    rows.forEach(function(event) {
      children.push(
        _jsxs(HStack, {
          modifiers: [padding({ top: 3, bottom: 3 })],
          children: [
            _jsx(Text, {
              modifiers: [font({ size: 13, weight: 'medium' }), foregroundStyle('#777777')],
              children: event.time || ''
            }),
            _jsx(Text, {
              modifiers: [font({ size: 14, weight: 'semibold' }), foregroundStyle('#222222'), lineLimit(1)],
              children: event.title || ''
            })
          ]
        })
      );
    });
  }

  if (remainingCount > 0) {
    children.push(
      _jsxs(Text, {
        modifiers: [font({ size: 12, weight: 'medium' }), foregroundStyle('#777777')],
        children: ['\\u307B\\u304B', remainingCount, '\\u4EF6']
      })
    );
  }

  return _jsx(VStack, {
    spacing: 8,
    modifiers: [padding({ top: 16, bottom: 16, leading: 16, trailing: 16 })],
    children: children
  });
}`;

const Widget = createWidget<YohakuTodayWidgetProps>(
  'YohakuTodayWidget',
  yohakuTodayWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

Widget.updateSnapshot({
  dateLabel: 'Today',
  events: [],
  totalCount: 0,
});

export default Widget;
