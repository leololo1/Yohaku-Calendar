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
      ? { width: 304, height: 196, cell: 25, title: 17, weekday: 11, day: 14, rowSpacing4: 8, rowSpacing5: 4, rowSpacing6: 2, columnSpacing: 15 }
      : size === 'small'
        ? { width: 136, height: 132, cell: 18, title: 15, weekday: 9, day: 11, rowSpacing4: 6, rowSpacing5: 3, rowSpacing6: 1, columnSpacing: 1 }
        : { width: 168, height: 136, cell: 22, title: 15, weekday: 10, day: 13, rowSpacing4: 6, rowSpacing5: 3, rowSpacing6: 1, columnSpacing: 2 };
    var weekdayLabels = ['\\u65E5', '\\u6708', '\\u706B', '\\u6C34', '\\u6728', '\\u91D1', '\\u571F'];
    var children = [];
    var activeWeekStarts = [];
    var weekStart;
    var offset;

    for (weekStart = 0; weekStart < 42; weekStart += 7) {
      var hasCurrentMonthDay = false;
      for (offset = 0; offset < 7; offset += 1) {
        var candidate = calendarDays[weekStart + offset] || {};
        if (candidate.label && !candidate.muted) {
          hasCurrentMonthDay = true;
        }
      }
      if (hasCurrentMonthDay) {
        activeWeekStarts.push(weekStart);
      }
    }

    if (activeWeekStarts.length === 0) {
      activeWeekStarts = [0, 7, 14, 21, 28];
    }

    var rowSpacing = activeWeekStarts.length <= 4
      ? config.rowSpacing4
      : activeWeekStarts.length === 5
        ? config.rowSpacing5
        : config.rowSpacing6;

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

    activeWeekStarts.forEach(function(weekStart) {
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
    });

    return _jsx(VStack, {
      alignment: 'leading',
      spacing: rowSpacing,
      modifiers: [frame({ width: config.width, height: config.height, alignment: 'leading' })],
      children: children
    });
  }

  function renderEventCard(event, width, height, titleSize, endSize) {
    var cardTitleSize = titleSize || 13;
    var cardEndSize = endSize || 11;
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
            font({ size: cardTitleSize, weight: 'regular' }),
            foregroundStyle('#222222'),
            lineLimit(1),
            multilineTextAlignment('leading')
          ],
          children: event.title || ''
        }),
        _jsx(Text, {
          modifiers: [
            font({ size: cardEndSize, weight: 'regular' }),
            foregroundStyle('#888888'),
            lineLimit(1),
            multilineTextAlignment('leading')
          ],
          children: eventEndLabel(event)
        })
      ]
    });
  }

  function renderTimeline(compact, fill) {
    var rows = events.slice(0, 3);
    var fillContainer = fill !== false;
    var railWidth = compact ? 84 : 72;
    var timeWidth = compact ? 44 : 42;
    var railHeight = compact ? 94 : 90;
    var halfCardWidth = compact ? 104 : 112;
    var fullCardWidth = compact ? 216 : 232;
    var topCardHeight = compact ? 72 : 54;
    var bottomCardHeight = compact ? 52 : 54;
    var cardGap = 8;
    var timelineHeight = compact ? 132 : 116;
    var titleSize = compact ? 15 : 14;
    var endSize = compact ? 13 : 12;
    var dateSize = compact ? 20 : 18;
    var timeSize = compact ? 13 : 12;
    var outerModifiers = fillContainer
      ? [
          padding({ top: compact ? 12 : 0, bottom: compact ? 12 : 0, leading: compact ? 12 : 0, trailing: compact ? 10 : 0 }),
          containerRelativeFrame({ axes: 'both', alignment: 'centerLeading' })
        ]
      : [frame({ width: railWidth + 12 + fullCardWidth, height: timelineHeight, alignment: 'topLeading' })];

    if (rows.length === 0) {
      return _jsxs(VStack, {
        alignment: 'leading',
        spacing: 10,
        modifiers: outerModifiers,
        children: [
          _jsx(Text, {
            modifiers: [font({ size: dateSize, weight: 'regular' }), foregroundStyle('#222222')],
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
    var bottomTime = rows.length > 1 ? (last.time || last.end || '') : (first.end || first.time || '');
    var cardChildren = [];

    if (rows.length === 1) {
      cardChildren.push(renderEventCard(first, fullCardWidth, topCardHeight, titleSize, endSize));
    } else {
      var topCards = [
        renderEventCard(rows[0], halfCardWidth, topCardHeight, titleSize, endSize),
        renderEventCard(rows[1], halfCardWidth, topCardHeight, titleSize, endSize)
      ];
      cardChildren.push(
        _jsxs(HStack, {
          alignment: 'top',
          spacing: cardGap,
          children: topCards
        })
      );
      if (rows.length > 2) {
        cardChildren.push(renderEventCard(rows[2], fullCardWidth, bottomCardHeight, titleSize, endSize));
      }
    }

    return _jsxs(HStack, {
      alignment: 'top',
      spacing: 12,
      modifiers: outerModifiers,
      children: [
        _jsxs(VStack, {
          alignment: 'leading',
          spacing: 8,
          modifiers: [frame({ width: railWidth, alignment: 'leading' })],
          children: [
            _jsx(Text, {
              modifiers: [font({ size: dateSize, weight: 'regular' }), foregroundStyle('#222222')],
              children: dateLabel
            }),
            _jsxs(HStack, {
              alignment: 'top',
              spacing: 6,
              children: [
                _jsxs(VStack, {
                  alignment: 'leading',
                  spacing: 0,
                  modifiers: [frame({ width: timeWidth, height: railHeight, alignment: 'topLeading' })],
                  children: [
                    _jsx(Text, {
                      modifiers: [font({ size: timeSize, weight: 'regular' }), foregroundStyle('#666666')],
                      children: first.time || ''
                    }),
                    _jsx(Spacer, {}),
                    _jsx(Text, {
                      modifiers: [font({ size: timeSize, weight: 'regular' }), foregroundStyle('#666666')],
                      children: bottomTime
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
          spacing: 0,
          children: [
            _jsx(VStack, {
              alignment: 'leading',
              spacing: cardGap,
              children: cardChildren
            })
          ]
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
    return renderTimeline(true, true);
  }

  if (isLarge) {
    return _jsxs(VStack, {
      alignment: 'leading',
      spacing: 8,
      modifiers: [
        padding({ top: 14, bottom: 14, leading: 18, trailing: 18 }),
        containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
      ],
      children: [
        renderCalendar('large'),
        _jsx(Divider, {}),
        renderTimeline(false, false)
      ]
    });
  }

  if (isMedium) {
    return _jsxs(HStack, {
      alignment: 'top',
      spacing: 12,
      modifiers: [
        padding({ top: 12, bottom: 12, leading: 12, trailing: 8 }),
        containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
      ],
      children: [
        renderCalendar('medium'),
        renderEventList(3, true),
        _jsx(Spacer, {})
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
