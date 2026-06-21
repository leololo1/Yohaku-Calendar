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
  var maxRows = environment && environment.widgetFamily === 'systemLarge' ? 6 : 3;
  var rows = events.slice(0, maxRows);
  var children = [
    _jsx(Text, {
      modifiers: [
        font({ size: 17, weight: 'semibold' }),
        foregroundStyle('#222222'),
        multilineTextAlignment('leading'),
        containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })
      ],
      children: dateLabel
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
          spacing: 18,
          alignment: 'center',
          modifiers: [
            padding({ top: 5, bottom: 5 }),
            containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })
          ],
          children: [
            _jsx(Text, {
              modifiers: [font({ size: 13, weight: 'medium' }), foregroundStyle('#555555'), frame({ width: 54, alignment: 'leading' })],
              children: event.time || ''
            }),
            _jsx(Text, {
              modifiers: [
                font({ size: 14, weight: 'semibold' }),
                foregroundStyle('#222222'),
                lineLimit(1),
                multilineTextAlignment('leading')
              ],
              children: event.title || ''
            }),
            _jsx(Spacer, {})
          ]
        })
      );
    });
  }

  return _jsx(VStack, {
    alignment: 'leading',
    spacing: 11,
    modifiers: [
      padding({ top: 18, bottom: 16, leading: 18, trailing: 18 }),
      containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
    ],
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
