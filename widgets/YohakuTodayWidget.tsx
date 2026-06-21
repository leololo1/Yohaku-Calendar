import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type YohakuTodayWidgetEvent = {
  title: string;
  time: string;
};

export type YohakuTodayWidgetCalendarDay = {
  key: string;
  label: string;
  muted: boolean;
  selected: boolean;
  eventCount: number;
};

export type YohakuTodayWidgetProps = {
  dateLabel?: string;
  monthLabel?: string;
  calendarDays?: YohakuTodayWidgetCalendarDay[];
  events?: YohakuTodayWidgetEvent[];
  totalCount?: number;
};

type YohakuTodayWidgetRenderer = (
  props: YohakuTodayWidgetProps,
  environment: WidgetEnvironment
) => React.JSX.Element;

const yohakuTodayWidgetLayout = `function(props, environment) {
  var events = Array.isArray(props.events) ? props.events : [];
  var calendarDays = Array.isArray(props.calendarDays) ? props.calendarDays : [];
  var dateLabel = props.dateLabel || 'Today';
  var monthLabel = props.monthLabel || '';
  var isMedium = environment && environment.widgetFamily === 'systemMedium';

  function renderEventList(maxRows, compact) {
    var rows = events.slice(0, maxRows);
    var children = [
      _jsx(Text, {
        modifiers: [
          font({ size: compact ? 14 : 17, weight: 'regular' }),
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
          modifiers: [font({ size: compact ? 12 : 14, weight: 'regular' }), foregroundStyle('#AAAAAA')],
          children: '\\u4E88\\u5B9A\\u306F\\u3042\\u308A\\u307E\\u305B\\u3093'
        })
      );
    } else {
      rows.forEach(function(event) {
        children.push(
          _jsxs(HStack, {
            spacing: compact ? 8 : 18,
            alignment: 'center',
            modifiers: [
              padding({ top: compact ? 3 : 5, bottom: compact ? 3 : 5 }),
              containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })
            ],
            children: [
              _jsx(Text, {
                modifiers: [
                  font({ size: compact ? 11 : 13, weight: 'regular' }),
                  foregroundStyle('#555555'),
                  frame({ width: compact ? 34 : 54, alignment: 'leading' })
                ],
                children: event.time || ''
              }),
              _jsx(Text, {
                modifiers: [
                  font({ size: compact ? 12 : 14, weight: 'regular' }),
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
      spacing: compact ? 7 : 11,
      modifiers: compact
        ? [frame({ width: 118, alignment: 'leading' })]
        : [
            padding({ top: 18, bottom: 16, leading: 18, trailing: 18 }),
            containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
          ],
      children: children
    });
  }

  function renderCalendar() {
    var weekdayLabels = ['\\u65E5', '\\u6708', '\\u706B', '\\u6C34', '\\u6728', '\\u91D1', '\\u571F'];
    var children = [];

    if (monthLabel) {
      children.push(
        _jsx(Text, {
          modifiers: [
            font({ size: 15, weight: 'regular' }),
            foregroundStyle('#222222'),
            containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })
          ],
          children: monthLabel
        })
      );
    }

    children.push(
      _jsx(HStack, {
        spacing: 2,
        modifiers: [containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })],
        children: weekdayLabels.map(function(label) {
          return _jsx(Text, {
            modifiers: [
              font({ size: 10, weight: 'regular' }),
              foregroundStyle('#AAAAAA'),
              frame({ width: 22, alignment: 'center' })
            ],
            children: label
          });
        })
      })
    );

    for (var weekStart = 0; weekStart < 42; weekStart += 7) {
      children.push(
        _jsx(HStack, {
          spacing: 2,
          modifiers: [containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })],
          children: [0, 1, 2, 3, 4, 5, 6].map(function(offset) {
            var day = calendarDays[weekStart + offset] || {};
            var hidden = !day.label || day.muted;
            var color = hidden ? '#FFFFFF' : day.selected ? '#222222' : day.eventCount > 0 ? '#666666' : '#C9C9C5';
            return _jsx(Text, {
              modifiers: [
                font({ size: 13, weight: 'regular' }),
                foregroundStyle(color),
                frame({ width: 22, alignment: 'center' }),
                lineLimit(1)
              ],
              children: hidden ? '' : day.label
            });
          })
        })
      );
    }

    return _jsx(VStack, {
      alignment: 'leading',
      spacing: 2,
      modifiers: [frame({ width: 168, alignment: 'leading' })],
      children: children
    });
  }

  if (isMedium) {
    return _jsxs(HStack, {
      alignment: 'top',
      spacing: 8,
      modifiers: [
        padding({ top: 10, bottom: 10, leading: 10, trailing: 8 }),
        containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
      ],
      children: [
        renderCalendar(),
        renderEventList(3, true)
      ]
    });
  }

  var maxRows = environment && environment.widgetFamily === 'systemLarge' ? 6 : 3;
  return renderEventList(maxRows, false);
}`;

const Widget = createWidget<YohakuTodayWidgetProps>(
  'YohakuTodayWidget',
  yohakuTodayWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

Widget.updateSnapshot({
  dateLabel: 'Today',
  monthLabel: '',
  calendarDays: [],
  events: [],
  totalCount: 0,
});

export default Widget;
