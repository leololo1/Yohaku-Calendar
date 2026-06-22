import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type YohakuTodayWidgetEvent = {
  title: string;
  time: string;
  end?: string;
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

const createYohakuWidgetLayout = (variant: 'today' | 'calendar' | 'timeline') => `function(props, environment) {
  var widgetVariant = '${variant}';
  var events = Array.isArray(props.events) ? props.events : [];
  var calendarDays = Array.isArray(props.calendarDays) ? props.calendarDays : [];
  var dateLabel = props.dateLabel || 'Today';
  var monthLabel = props.monthLabel || '';
  var isSmall = environment && environment.widgetFamily === 'systemSmall';
  var isMedium = environment && environment.widgetFamily === 'systemMedium';
  var isLarge = environment && environment.widgetFamily === 'systemLarge';

  function eventEndLabel(event) {
    return event && event.end ? '~' + event.end : '';
  }

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

  function renderCalendar(size) {
    var config = size === 'large'
      ? { width: 326, cell: 36, title: 17, weekday: 12, day: 14, rowSpacing: 5, columnSpacing: 8 }
      : size === 'small'
        ? { width: 136, cell: 18, title: 15, weekday: 9, day: 11, rowSpacing: 2, columnSpacing: 1 }
        : { width: 168, cell: 22, title: 15, weekday: 10, day: 13, rowSpacing: 2, columnSpacing: 2 };
    var weekdayLabels = ['\\u65E5', '\\u6708', '\\u706B', '\\u6C34', '\\u6728', '\\u91D1', '\\u571F'];
    var children = [];

    if (monthLabel) {
      children.push(
        _jsx(Text, {
          modifiers: [
            font({ size: config.title, weight: 'regular' }),
            foregroundStyle('#222222'),
            containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })
          ],
          children: monthLabel
        })
      );
    }

    children.push(
      _jsx(HStack, {
        spacing: config.columnSpacing,
        modifiers: [containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })],
        children: weekdayLabels.map(function(label) {
          return _jsx(Text, {
            modifiers: [
              font({ size: config.weekday, weight: 'regular' }),
              foregroundStyle('#AAAAAA'),
              frame({ width: config.cell, alignment: 'center' })
            ],
            children: label
          });
        })
      })
    );

    for (var weekStart = 0; weekStart < 42; weekStart += 7) {
      children.push(
        _jsx(HStack, {
          spacing: config.columnSpacing,
          modifiers: [containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })],
          children: [0, 1, 2, 3, 4, 5, 6].map(function(offset) {
            var day = calendarDays[weekStart + offset] || {};
            var hidden = !day.label || day.muted;
            var color = hidden ? '#FFFFFF' : day.selected ? '#222222' : day.eventCount > 0 ? '#666666' : '#C9C9C5';
            var dayChildren = [];

            if (!hidden && day.selected) {
              dayChildren.push(
                _jsx(Circle, {
                  modifiers: [
                    foregroundStyle('#E8E8E5'),
                    frame({ width: config.cell, height: config.cell })
                  ]
                })
              );
            }

            dayChildren.push(
              _jsx(Text, {
                modifiers: [
                  font({ size: config.day, weight: 'regular' }),
                  foregroundStyle(color),
                  frame({ width: config.cell, height: config.cell, alignment: 'center' }),
                  lineLimit(1)
                ],
                children: hidden ? '' : day.label
              })
            );

            return _jsxs(ZStack, {
              modifiers: [frame({ width: config.cell, height: config.cell, alignment: 'center' })],
              children: dayChildren
            });
          })
        })
      );
    }

    return _jsx(VStack, {
      alignment: 'leading',
      spacing: config.rowSpacing,
      modifiers: [frame({ width: config.width, alignment: 'leading' })],
      children: children
    });
  }

  function renderEventCard(event, width, height) {
    return _jsxs(VStack, {
      alignment: 'leading',
      spacing: 4,
      modifiers: [
        frame({ width: width, height: height, alignment: 'topLeading' }),
        padding({ top: 9, bottom: 8, leading: 10, trailing: 10 }),
        background('#F5F2F2'),
        cornerRadius(7)
      ],
      children: [
        _jsx(Text, {
          modifiers: [
            font({ size: 13, weight: 'regular' }),
            foregroundStyle('#222222'),
            lineLimit(1),
            multilineTextAlignment('leading')
          ],
          children: event.title || ''
        }),
        _jsx(Text, {
          modifiers: [
            font({ size: 11, weight: 'regular' }),
            foregroundStyle('#888888'),
            lineLimit(1),
            multilineTextAlignment('leading')
          ],
          children: eventEndLabel(event)
        })
      ]
    });
  }

  function renderTimeline(compact) {
    var rows = events.slice(0, 3);
    var cardWidth = compact ? 92 : 122;
    var tallHeight = compact ? 92 : 104;
    var shortHeight = compact ? 42 : 48;
    var railHeight = compact ? 76 : 86;
    var railWidth = compact ? 64 : 72;

    if (rows.length === 0) {
      return _jsxs(VStack, {
        alignment: 'leading',
        spacing: 10,
        modifiers: [
          padding({ top: compact ? 10 : 12, bottom: compact ? 10 : 12, leading: compact ? 12 : 18, trailing: compact ? 12 : 18 }),
          containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
        ],
        children: [
          _jsx(Text, {
            modifiers: [font({ size: compact ? 15 : 16, weight: 'regular' }), foregroundStyle('#222222')],
            children: dateLabel
          }),
          _jsx(Text, {
            modifiers: [font({ size: compact ? 13 : 14, weight: 'regular' }), foregroundStyle('#AAAAAA')],
            children: '\\u4E88\\u5B9A\\u306F\\u3042\\u308A\\u307E\\u305B\\u3093'
          })
        ]
      });
    }

    var first = rows[0];
    var last = rows[rows.length - 1];
    var cards = [];
    cards.push(renderEventCard(first, cardWidth, rows.length === 1 ? shortHeight : tallHeight));

    if (rows.length > 1) {
      cards.push(
        _jsxs(VStack, {
          alignment: 'leading',
          spacing: 8,
          children: rows.slice(1, 3).map(function(event) {
            return renderEventCard(event, cardWidth, shortHeight);
          })
        })
      );
    }

    return _jsxs(HStack, {
      alignment: 'top',
      spacing: compact ? 10 : 14,
      modifiers: [
        padding({ top: compact ? 10 : 12, bottom: compact ? 10 : 12, leading: compact ? 12 : 18, trailing: compact ? 10 : 18 }),
        containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
      ],
      children: [
        _jsxs(VStack, {
          alignment: 'leading',
          spacing: 8,
          modifiers: [frame({ width: railWidth, alignment: 'leading' })],
          children: [
            _jsx(Text, {
              modifiers: [font({ size: compact ? 15 : 16, weight: 'regular' }), foregroundStyle('#222222')],
              children: dateLabel
            }),
            _jsxs(HStack, {
              alignment: 'top',
              spacing: 6,
              children: [
                _jsxs(VStack, {
                  alignment: 'leading',
                  spacing: 0,
                  modifiers: [frame({ width: compact ? 36 : 42, height: railHeight, alignment: 'topLeading' })],
                  children: [
                    _jsx(Text, {
                      modifiers: [font({ size: compact ? 10 : 12, weight: 'regular' }), foregroundStyle('#666666')],
                      children: first.time || ''
                    }),
                    _jsx(Spacer, {}),
                    _jsx(Text, {
                      modifiers: [font({ size: compact ? 10 : 12, weight: 'regular' }), foregroundStyle('#666666')],
                      children: last.end || last.time || ''
                    })
                  ]
                }),
                _jsxs(VStack, {
                  alignment: 'center',
                  spacing: 0,
                  modifiers: [frame({ width: 12, height: railHeight, alignment: 'center' })],
                  children: [
                    _jsx(Circle, { modifiers: [foregroundStyle('#D4D4D0'), frame({ width: 7, height: 7 })] }),
                    _jsx(Rectangle, { modifiers: [foregroundStyle('#E1E1DE'), frame({ width: 1, height: Math.max(20, railHeight - 14) })] }),
                    _jsx(Circle, { modifiers: [foregroundStyle('#D4D4D0'), frame({ width: 7, height: 7 })] })
                  ]
                })
              ]
            })
          ]
        }),
        _jsxs(HStack, {
          alignment: 'top',
          spacing: 8,
          children: cards
        }),
        _jsx(Spacer, {})
      ]
    });
  }

  if (widgetVariant === 'calendar') {
    return _jsx(VStack, {
      alignment: 'center',
      spacing: 0,
      modifiers: [
        padding({ top: 10, bottom: 10, leading: 8, trailing: 8 }),
        containerRelativeFrame({ axes: 'both', alignment: 'center' })
      ],
      children: renderCalendar('small')
    });
  }

  if (widgetVariant === 'timeline') {
    return renderTimeline(true);
  }

  if (isLarge) {
    return _jsxs(VStack, {
      alignment: 'leading',
      spacing: 12,
      modifiers: [
        padding({ top: 16, bottom: 16, leading: 18, trailing: 18 }),
        containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
      ],
      children: [
        renderCalendar('large'),
        _jsx(Divider, {}),
        renderTimeline(false)
      ]
    });
  }

  if (isMedium) {
    return _jsxs(HStack, {
      alignment: 'center',
      spacing: 8,
      modifiers: [
        padding({ top: 10, bottom: 10, leading: 10, trailing: 8 }),
        containerRelativeFrame({ axes: 'both', alignment: 'centerLeading' })
      ],
      children: [
        renderCalendar('medium'),
        renderEventList(3, true)
      ]
    });
  }

  return renderEventList(3, false);
}`;

const yohakuTodayWidgetLayout = createYohakuWidgetLayout('today');
const yohakuCalendarWidgetLayout = createYohakuWidgetLayout('calendar');
const yohakuTimelineWidgetLayout = createYohakuWidgetLayout('timeline');

const Widget = createWidget<YohakuTodayWidgetProps>(
  'YohakuTodayWidget',
  yohakuTodayWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

export const YohakuCalendarWidget = createWidget<YohakuTodayWidgetProps>(
  'YohakuCalendarWidget',
  yohakuCalendarWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

export const YohakuTimelineWidget = createWidget<YohakuTodayWidgetProps>(
  'YohakuTimelineWidget',
  yohakuTimelineWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

Widget.updateSnapshot({
  dateLabel: 'Today',
  monthLabel: '',
  calendarDays: [],
  events: [],
  totalCount: 0,
});

YohakuCalendarWidget.updateSnapshot({
  dateLabel: 'Today',
  monthLabel: '',
  calendarDays: [],
  events: [],
  totalCount: 0,
});

YohakuTimelineWidget.updateSnapshot({
  dateLabel: 'Today',
  monthLabel: '',
  calendarDays: [],
  events: [],
  totalCount: 0,
});

export default Widget;
