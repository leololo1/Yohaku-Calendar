import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type YohakuTodayWidgetEvent = {
  id?: string;
  title: string;
  date?: string;
  endDate?: string;
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
  dateKey?: string;
  dateLabel?: string;
  monthLabel?: string;
  themeBackground?: string;
  themeSurface?: string;
  themeBorder?: string;
  themeDot?: string;
  calendarDays?: YohakuTodayWidgetCalendarDay[];
  events?: YohakuTodayWidgetEvent[];
  timelineEvents?: YohakuTodayWidgetEvent[];
  totalCount?: number;
};

type YohakuTodayWidgetRenderer = (
  props: YohakuTodayWidgetProps,
  environment: WidgetEnvironment
) => React.JSX.Element;

const createYohakuWidgetLayout = (
  variant:
    | 'today'
    | 'calendar'
    | 'timeline'
    | 'lockTasks'
    | 'lockCalendar'
) => `function(props, environment) {
  var widgetVariant = '${variant}';
  var events = Array.isArray(props.events) ? props.events : [];
  var timelineEvents = Array.isArray(props.timelineEvents) ? props.timelineEvents : events;
  var calendarDays = Array.isArray(props.calendarDays) ? props.calendarDays : [];
  var dateKey = props.dateKey || '';
  var dateLabel = props.dateLabel || 'Today';
  var monthLabel = props.monthLabel || '';
  var themeBackground = props.themeBackground || '#FFFFFF';
  var themeSurface = props.themeSurface || '#F7F7F5';
  var themeBorder = props.themeBorder || '#E8E8E5';
  var themeDot = props.themeDot || '#D7D7D3';
  var isSmall = environment && environment.widgetFamily === 'systemSmall';
  var isMedium = environment && environment.widgetFamily === 'systemMedium';
  var isLarge = environment && environment.widgetFamily === 'systemLarge';
  var largeContentWidth = 316;
  var scheduleDefaultVisualDuration = 60;

  function eventEndLabel(event) {
    return event && event.end ? '~' + event.end : '';
  }

  function dateColorForEventCount(eventCount) {
    if (eventCount === 0) {
      return '#DADAD6';
    }
    if (eventCount === 1) {
      return '#858581';
    }
    return '#222222';
  }

  function lockDateStyleForEventCount(eventCount) {
    if (eventCount === 0) {
      return { type: 'hierarchical', style: 'quaternary' };
    }
    if (eventCount === 1) {
      return { type: 'hierarchical', style: 'secondary' };
    }
    return { type: 'hierarchical', style: 'primary' };
  }

  function minutesFromTime(time) {
    var parts = String(time || '').split(':');
    var hour = Number(parts[0]);
    var minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return 0;
    }

    return hour * 60 + minute;
  }

  function formatTimelineTime(minutes) {
    var hour = Math.floor(minutes / 60);
    var minute = minutes % 60;
    return String(hour) + ':' + String(minute).padStart(2, '0');
  }

  function eventStartDate(event) {
    return event && event.date ? event.date : dateKey;
  }

  function eventEndDate(event) {
    return event && event.endDate ? event.endDate : eventStartDate(event);
  }

  function isMultiDayEvent(event) {
    return eventEndDate(event) !== eventStartDate(event);
  }

  function eventDuration(event) {
    return Math.max(10, minutesFromTime(event && event.end) - minutesFromTime(event && event.time));
  }

  function visualDurationForMultiDayEvent(items, currentDateKey, eventIndex) {
    var sameDayEvent = null;
    items.forEach(function(candidate, candidateIndex) {
      if (
        sameDayEvent === null &&
        candidateIndex !== eventIndex &&
        eventStartDate(candidate) === currentDateKey &&
        eventEndDate(candidate) === currentDateKey
      ) {
        sameDayEvent = candidate;
      }
    });

    return sameDayEvent ? eventDuration(sameDayEvent) : scheduleDefaultVisualDuration;
  }

  function eventTimelineSegment(event, currentDateKey, visualDuration) {
    var startsToday = eventStartDate(event) === currentDateKey;
    var endsToday = eventEndDate(event) === currentDateKey;
    var start = startsToday ? minutesFromTime(event && event.time) : 0;
    var spansMultipleDays = isMultiDayEvent(event);
    var end = spansMultipleDays ? start + visualDuration : endsToday ? minutesFromTime(event && event.end) : 24 * 60;

    return {
      start: start,
      end: Math.max(start + 10, end)
    };
  }

  function sortEventsForTimeline(items, currentDateKey) {
    return items.slice().sort(function(first, second) {
      var firstSegment = eventTimelineSegment(first, currentDateKey, scheduleDefaultVisualDuration);
      var secondSegment = eventTimelineSegment(second, currentDateKey, scheduleDefaultVisualDuration);
      return firstSegment.start - secondSegment.start || firstSegment.end - secondSegment.end;
    });
  }

  function timelineEntriesOverlap(first, second) {
    return first.start < second.end && second.start < first.end;
  }

  function expandTimelineEntryColumns(entries, columnCount) {
    return entries.map(function(entry) {
      var columnSpan = 1;
      var column;

      for (column = entry.column + 1; column < columnCount; column += 1) {
        var columnIsOccupied = entries.some(function(candidate) {
          return candidate.column === column && timelineEntriesOverlap(entry, candidate);
        });

        if (columnIsOccupied) {
          break;
        }
        columnSpan += 1;
      }

      return {
        event: entry.event,
        start: entry.start,
        end: entry.end,
        column: entry.column,
        columnSpan: columnSpan
      };
    });
  }

  function timelineEntryHasPreviousNeighbor(entry, entries) {
    return entries.some(function(candidate) {
      if (candidate.end !== entry.start) {
        return false;
      }

      var entryRight = entry.column + entry.columnSpan;
      var candidateRight = candidate.column + candidate.columnSpan;
      return candidate.column < entryRight && candidateRight > entry.column;
    });
  }

  function buildTimelineGroups(items, currentDateKey) {
    var sortedEvents = sortEventsForTimeline(items, currentDateKey);
    var groups = [];

    sortedEvents.forEach(function(event, eventIndex) {
      var visualDuration = isMultiDayEvent(event)
        ? visualDurationForMultiDayEvent(sortedEvents, currentDateKey, eventIndex)
        : scheduleDefaultVisualDuration;
      var segment = eventTimelineSegment(event, currentDateKey, visualDuration);
      var lastGroup = groups[groups.length - 1];

      if (!lastGroup || segment.start >= lastGroup.end) {
        groups.push({
          start: segment.start,
          end: segment.end,
          columnCount: 1,
          entries: [{ event: event, start: segment.start, end: segment.end, column: 0, columnSpan: 1 }]
        });
        return;
      }

      lastGroup.end = Math.max(lastGroup.end, segment.end);
      lastGroup.entries.push({ event: event, start: segment.start, end: segment.end, column: 0, columnSpan: 1 });
    });

    return groups.map(function(group) {
      var columnEnds = [];
      var entries = group.entries.map(function(entry) {
        var column = -1;
        columnEnds.forEach(function(columnEnd, columnIndex) {
          if (column === -1 && entry.start >= columnEnd) {
            column = columnIndex;
          }
        });
        var nextColumn = column === -1 ? columnEnds.length : column;
        columnEnds[nextColumn] = entry.end;

        return {
          event: entry.event,
          start: entry.start,
          end: entry.end,
          column: nextColumn
        };
      });

      var columnCount = Math.max(1, columnEnds.length);

      return {
        start: group.start,
        end: group.end,
        columnCount: columnCount,
        entries: expandTimelineEntryColumns(entries, columnCount)
      };
    });
  }

  function renderEventList(maxRows, compact) {
    var rows = events.slice(0, maxRows);
    var compactListHeight = 136;
    var compactHeaderHeight = 18;
    var compactListSpacing = 4;
    var compactRowHeight = (compactListHeight - compactHeaderHeight - compactListSpacing * maxRows) / maxRows;
    var headerModifiers = [
      font({ size: compact ? 14 : 15, weight: 'regular' }),
      foregroundStyle('#222222'),
      multilineTextAlignment('leading')
    ];

    if (compact) {
      headerModifiers.push(
        lineLimit(1),
        frame({ width: 118, height: compactHeaderHeight, alignment: 'topLeading' })
      );
    } else {
      headerModifiers.push(containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' }));
    }

    var children = [
      _jsx(Text, {
        modifiers: headerModifiers,
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
            modifiers: compact
              ? [frame({ width: 118, height: compactRowHeight, alignment: 'leading' })]
              : [
                  padding({ top: 5, bottom: 5 }),
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

    var listModifiers = compact
      ? [frame({ width: 118, height: compactListHeight, alignment: 'topLeading' })]
      : [
          padding({ top: 18, bottom: 16, leading: 18, trailing: 18 }),
          containerRelativeFrame({ axes: 'both', alignment: 'topLeading' })
        ];

    return _jsx(VStack, {
      alignment: 'leading',
      spacing: compact ? compactListSpacing : 11,
      modifiers: listModifiers,
      children: children
    });
  }

  function renderCalendar(size) {
    var config = size === 'large'
      ? { width: largeContentWidth, height: 190, cell: 25, title: 14, weekday: 11, day: 14, rowSpacing4: 8, rowSpacing5: 4, rowSpacing6: 1, columnSpacing: 23.5 }
      : size === 'small'
        ? { width: 136, height: 132, cell: 18, title: 15, weekday: 9, day: 11, rowSpacing4: 6, rowSpacing5: 3, rowSpacing6: 1, columnSpacing: 1 }
        : { width: 160, height: 124, outerHeight: 136, cell: 19, title: 14, titleHeight: 18, weekday: 9, day: 12, rowSpacing4: 7, rowSpacing5: 1, rowSpacing6: 0, columnSpacing: 3 };
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
      var monthTitleModifiers = [
        font({ size: config.title, weight: 'regular' }),
        foregroundStyle('#222222')
      ];

      if (config.titleHeight) {
        monthTitleModifiers.push(
          lineLimit(1),
          frame({ width: config.width, height: config.titleHeight, alignment: 'topLeading' })
        );
      } else {
        monthTitleModifiers.push(containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' }));
      }

      children.push(
        _jsx(Text, {
          modifiers: monthTitleModifiers,
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
            var color = hidden ? '#FFFFFF' : dateColorForEventCount(day.eventCount || 0);
            var dayChildren = [];

            if (!hidden && day.selected) {
              dayChildren.push(
                _jsx(Circle, {
                  modifiers: [
                    foregroundStyle(themeDot),
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

    var calendarContentModifiers = config.outerHeight
      ? [frame({ width: config.width, alignment: 'leading' })]
      : [frame({ width: config.width, height: config.height, alignment: 'leading' })];

    var calendarContent = _jsx(VStack, {
      alignment: 'leading',
      spacing: rowSpacing,
      modifiers: calendarContentModifiers,
      children: children
    });

    if (config.outerHeight) {
      return _jsx(VStack, {
        alignment: 'leading',
        spacing: 0,
        modifiers: [frame({ width: config.width, height: config.outerHeight, alignment: 'topLeading' })],
        children: [
          calendarContent,
          _jsx(Spacer, {})
        ]
      });
    }

    return calendarContent;
  }

  function renderEventCard(event, width, height, titleSize, endSize, compactCard, showEnd) {
    var cardTitleSize = titleSize || 13;
    var cardEndSize = endSize || 11;
    var children = [
      _jsx(Text, {
        modifiers: [
          font({ size: cardTitleSize, weight: 'regular' }),
          foregroundStyle('#222222'),
          lineLimit(1),
          multilineTextAlignment('leading')
        ],
        children: event.title || ''
      })
    ];

    if (showEnd !== false) {
      children.push(
        _jsx(Text, {
          modifiers: [
            font({ size: cardEndSize, weight: 'regular' }),
            foregroundStyle('#888888'),
            lineLimit(1),
            multilineTextAlignment('leading')
          ],
          children: eventEndLabel(event)
        })
      );
    }

    return _jsxs(VStack, {
      alignment: 'leading',
      spacing: compactCard ? 2 : 4,
      modifiers: [
        padding({
          top: compactCard ? 5 : 9,
          bottom: compactCard ? 5 : 8,
          leading: compactCard ? 8 : 10,
          trailing: compactCard ? 8 : 10
        }),
        frame({ width: width, height: height, alignment: 'topLeading' }),
        background(themeSurface),
        cornerRadius(7)
      ],
      children: children
    });
  }

  function lockTaskRows(maxRows, showEnd) {
    var rows = timelineEvents.slice(0, maxRows);

    if (rows.length === 0) {
      return [
        _jsx(Text, {
          modifiers: [
            font({ size: 12, weight: 'regular' }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1)
          ],
          children: '\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093'
        })
      ];
    }

    return rows.map(function(event) {
      var timeLabel = event.time || '';
      if (showEnd && event.end) {
        timeLabel += '~' + event.end;
      }

      return _jsxs(HStack, {
        alignment: 'center',
        spacing: 5,
        modifiers: [containerRelativeFrame({ axes: 'horizontal', alignment: 'leading' })],
        children: [
          _jsx(Text, {
            modifiers: [
              font({ size: showEnd ? 9 : 10, weight: 'medium' }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              frame({ width: showEnd ? 62 : 34, alignment: 'leading' }),
              lineLimit(1)
            ],
            children: timeLabel
          }),
          _jsx(Text, {
            modifiers: [
              font({ size: 12, weight: 'semibold' }),
              foregroundStyle('primary'),
              lineLimit(1),
              multilineTextAlignment('leading')
            ],
            children: event.title || ''
          }),
          _jsx(Spacer, {})
        ]
      });
    });
  }

  function renderLockTasks() {
    return _jsx(VStack, {
      alignment: 'leading',
      spacing: 1,
      modifiers: [containerRelativeFrame({ axes: 'both', alignment: 'centerLeading' })],
      children: lockTaskRows(3, false)
    });
  }

  function renderLockCalendar() {
    var weekdayLabels = ['\u65E5', '\u6708', '\u706B', '\u6C34', '\u6728', '\u91D1', '\u571F'];
    var weekStarts = [];
    var weekStart;
    var offset;
    var calendarRows = [];

    for (weekStart = 0; weekStart < 42; weekStart += 7) {
      var hasCurrentMonthDay = false;
      for (offset = 0; offset < 7; offset += 1) {
        var candidate = calendarDays[weekStart + offset] || {};
        if (candidate.label && !candidate.muted) {
          hasCurrentMonthDay = true;
        }
      }
      if (hasCurrentMonthDay) {
        weekStarts.push(weekStart);
      }
    }

    if (weekStarts.length === 0) {
      weekStarts = [0, 7, 14, 21, 28];
    }

    calendarRows.push(
      _jsx(HStack, {
        spacing: 4,
        modifiers: [frame({ width: 150, height: 8, alignment: 'leading' })],
        children: weekdayLabels.map(function(label) {
          return _jsx(Text, {
            modifiers: [
              font({ size: 6, weight: 'medium' }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              frame({ width: 18, height: 8, alignment: 'center' }),
              lineLimit(1)
            ],
            children: label
          });
        })
      })
    );

    weekStarts.forEach(function(start) {
      calendarRows.push(
        _jsx(HStack, {
          spacing: 4,
          modifiers: [frame({ width: 150, height: 8, alignment: 'leading' })],
          children: [0, 1, 2, 3, 4, 5, 6].map(function(dayOffset) {
            var day = calendarDays[start + dayOffset] || {};
            var hidden = !day.label || day.muted;
            var dayChildren = [];

            dayChildren.push(
              _jsx(Text, {
                modifiers: [
                  font({ size: 7, weight: 'medium' }),
                  foregroundStyle(lockDateStyleForEventCount(day.eventCount || 0)),
                  frame({ width: 18, height: 8, alignment: 'center' }),
                  lineLimit(1)
                ],
                children: hidden ? '' : day.label
              })
            );

            return _jsxs(ZStack, {
              modifiers: [frame({ width: 18, height: 8, alignment: 'center' })],
              children: dayChildren
            });
          })
        })
      );
    });

    return _jsx(VStack, {
      alignment: 'leading',
      spacing: 0,
      modifiers: [containerRelativeFrame({ axes: 'both', alignment: 'center' })],
      children: [
        _jsx(Text, {
          modifiers: [
            font({ size: 9, weight: 'semibold' }),
            foregroundStyle('primary'),
            frame({ width: 150, height: 10, alignment: 'leading' }),
            lineLimit(1)
          ],
          children: monthLabel
        }),
        _jsx(VStack, {
          alignment: 'leading',
          spacing: 0,
          modifiers: [frame({ width: 150, alignment: 'leading' })],
          children: calendarRows
        })
      ]
    });
  }

  function renderTimeline(compact, fill) {
    var currentDateKey = dateKey || '';
    if (!currentDateKey) {
      calendarDays.forEach(function(day) {
        if (!currentDateKey && day && day.selected) {
          currentDateKey = day.key || '';
        }
      });
    }

    var groups = buildTimelineGroups(timelineEvents, currentDateKey);
    var fillContainer = fill !== false;
    var tightCards = compact || !fillContainer;
    var railWidth = compact ? 72 : 72;
    var timeWidth = compact ? 40 : 42;
    var cardGap = compact ? 5 : 6;
    var fullCardWidth = compact ? largeContentWidth - railWidth - 12 : 232;
    var timelineContentWidth = railWidth + 12 + fullCardWidth;
    var timelineHeight = compact ? 140 : 167;
    var titleSize = compact ? 12 : 13;
    var endSize = compact ? 10 : 11;
    var dateSize = 14;
    var timeSize = compact ? 12 : 12;
    var titleBlockHeight = 21;
    var titleGap = compact ? 4 : 5;
    var timelineAreaHeight = Math.max(1, timelineHeight - titleBlockHeight - titleGap);
    var baseHourHeight = compact ? 38 : 41;
    var availableRowHeight = Math.max(0, timelineAreaHeight - Math.max(0, groups.length - 1) * cardGap);
    var naturalRowHeights = groups.map(function(group) {
      return Math.max(baseHourHeight, ((group.end - group.start) / 60) * baseHourHeight);
    });
    var naturalRowsHeight = naturalRowHeights.reduce(function(total, height) {
      return total + height;
    }, 0);
    var rowScale = naturalRowsHeight > 0 ? availableRowHeight / naturalRowsHeight : 1;
    var rowHeights = naturalRowHeights.map(function(height) {
      return Math.max(1, height * rowScale);
    });
    var outerModifiers = fillContainer
      ? [
          padding({
            top: compact ? 17 : 0,
            bottom: compact ? 17 : 0,
            leading: compact ? 18 : 0,
            trailing: compact ? 18 : 0
          }),
          containerRelativeFrame({ axes: 'both', alignment: compact ? 'center' : 'centerLeading' })
        ]
      : [frame({ width: timelineContentWidth, height: timelineHeight, alignment: 'topLeading' })];

    if (groups.length === 0) {
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

    var timelineRows = groups.map(function(group, groupIndex) {
      var columnCount = Math.max(1, group.columnCount || group.entries.length);
      var columnWidth = (fullCardWidth - cardGap * Math.max(0, columnCount - 1)) / columnCount;
      var rowHeight = rowHeights[groupIndex];
      var groupDuration = Math.max(1, group.end - group.start);
      var markerStarts = [];
      group.entries.forEach(function(entry) {
        if (markerStarts.indexOf(entry.start) === -1) {
          markerStarts.push(entry.start);
        }
      });
      markerStarts.sort(function(first, second) {
        return first - second;
      });
      var markerPositions = markerStarts.map(function(start) {
        var markerTop = ((start - group.start) / groupDuration) * rowHeight;
        var previousNeighborInset = 0;

        group.entries.forEach(function(entry) {
          if (entry.start !== start || !timelineEntryHasPreviousNeighbor(entry, group.entries)) {
            return;
          }

          var rawHeight = Math.max(1, ((entry.end - entry.start) / groupDuration) * rowHeight);
          previousNeighborInset = Math.max(previousNeighborInset, Math.min(4, Math.max(0, rawHeight - 1)));
        });

        return { start: start, top: markerTop + previousNeighborInset };
      });
      var timeMarkers = markerPositions.map(function(markerPosition) {
        var markerHeight = Math.max(1, Math.min(18, rowHeight - markerPosition.top));
        return _jsx(ZStack, {
          alignment: 'topLeading',
          modifiers: [
            frame({ width: timeWidth, height: markerHeight, alignment: 'topLeading' }),
            offset({ x: 0, y: markerPosition.top })
          ],
          children: _jsx(Text, {
            modifiers: [
              font({ size: timeSize, weight: 'regular' }),
              foregroundStyle('#666666'),
              lineLimit(1),
              frame({ width: timeWidth, height: markerHeight, alignment: 'topLeading' })
            ],
            children: formatTimelineTime(markerPosition.start)
          })
        });
      });
      var markerChildren = [
        _jsx(Rectangle, {
          modifiers: [
            foregroundStyle(themeBorder),
            frame({ width: 1, height: Math.max(1, rowHeight - 7) }),
            offset({ x: 0, y: 7 })
          ]
        })
      ];
      markerPositions.forEach(function(markerPosition) {
        markerChildren.push(
          _jsx(Circle, {
            modifiers: [
              foregroundStyle(themeDot),
              frame({ width: 7, height: 7 }),
              offset({ x: 0, y: markerPosition.top })
            ]
          })
        );
      });
      var entryChildren = group.entries.map(function(entry) {
        var rawTop = ((entry.start - group.start) / groupDuration) * rowHeight;
        var rawHeight = Math.max(1, ((entry.end - entry.start) / groupDuration) * rowHeight);
        var previousNeighborInset = timelineEntryHasPreviousNeighbor(entry, group.entries)
          ? Math.min(4, Math.max(0, rawHeight - 1))
          : 0;
        var cardTop = rawTop + previousNeighborInset;
        var cardHeight = Math.max(1, rawHeight - previousNeighborInset);
        var columnSpan = Math.max(1, entry.columnSpan || 1);
        var cardWidth = columnWidth * columnSpan + cardGap * Math.max(0, columnSpan - 1);
        var cardLeft = entry.column * (columnWidth + cardGap);
        var compactCard = tightCards || columnCount >= 3 || cardHeight < 34;
        var showEnd = cardHeight >= 32;

        return _jsx(ZStack, {
          alignment: 'topLeading',
          modifiers: [
            frame({ width: cardWidth, height: cardHeight, alignment: 'topLeading' }),
            offset({ x: cardLeft, y: cardTop })
          ],
          children: renderEventCard(entry.event, cardWidth, cardHeight, titleSize, endSize, compactCard, showEnd)
        });
      });

      return _jsxs(HStack, {
        alignment: 'top',
        spacing: 12,
        modifiers: [frame({ width: timelineContentWidth, height: rowHeight, alignment: 'topLeading' })],
        children: [
          _jsxs(HStack, {
            alignment: 'top',
            spacing: 6,
            modifiers: [frame({ width: railWidth, height: rowHeight, alignment: 'topLeading' })],
            children: [
              _jsx(ZStack, {
                alignment: 'topLeading',
                modifiers: [frame({ width: timeWidth, height: rowHeight, alignment: 'topLeading' })],
                children: timeMarkers
              }),
              _jsx(ZStack, {
                alignment: 'top',
                modifiers: [frame({ width: 12, height: rowHeight, alignment: 'top' })],
                children: markerChildren
              })
            ]
          }),
          _jsx(ZStack, {
            alignment: 'topLeading',
            modifiers: [frame({ width: fullCardWidth, height: rowHeight, alignment: 'topLeading' })],
            children: entryChildren
          })
        ]
      });
    });

    return _jsxs(VStack, {
      alignment: 'leading',
      spacing: titleGap,
      modifiers: outerModifiers,
      children: [
        _jsx(Text, {
          modifiers: [
            font({ size: dateSize, weight: 'regular' }),
            foregroundStyle('#222222'),
            frame({ height: titleBlockHeight, alignment: 'topLeading' })
          ],
          children: dateLabel
        }),
        _jsx(VStack, {
          alignment: 'leading',
          spacing: cardGap,
          modifiers: [frame({ width: timelineContentWidth, height: timelineAreaHeight, alignment: 'topLeading' })],
          children: timelineRows
        }),
        _jsx(Spacer, {})
      ]
    });
  }

  function renderHomeWidgetShell(content, alignment, frameAlignment) {
    return _jsx(VStack, {
      alignment: alignment,
      spacing: 0,
      modifiers: [
        containerRelativeFrame({ axes: 'both', alignment: frameAlignment }),
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: frameAlignment }),
        background(themeBackground)
      ],
      children: content
    });
  }

  if (widgetVariant === 'lockTasks') {
    return renderLockTasks();
  }

  if (widgetVariant === 'lockCalendar') {
    return renderLockCalendar();
  }

  if (widgetVariant === 'calendar') {
    return renderHomeWidgetShell(_jsx(VStack, {
      alignment: 'center',
      spacing: 0,
      modifiers: [
        padding({ top: 10, bottom: 10, leading: 8, trailing: 8 })
      ],
      children: renderCalendar('small')
    }), 'center', 'center');
  }

  if (widgetVariant === 'timeline') {
    return renderHomeWidgetShell(renderTimeline(true, false), 'center', 'center');
  }

  if (isLarge) {
    return renderHomeWidgetShell(_jsxs(VStack, {
      alignment: 'center',
      spacing: 6,
      modifiers: [
        padding({ top: 12, bottom: 12, leading: 18, trailing: 18 })
      ],
      children: [
        renderCalendar('large'),
        renderTimeline(false, false)
      ]
    }), 'center', 'top');
  }

  if (isMedium) {
    return renderHomeWidgetShell(_jsxs(HStack, {
      alignment: 'center',
      spacing: 12,
      modifiers: [
        padding({ top: 12, bottom: 12, leading: 18, trailing: 12 }),
        containerRelativeFrame({ axes: 'horizontal', alignment: 'centerLeading' })
      ],
      children: [
        renderCalendar('medium'),
        renderEventList(3, true),
        _jsx(Spacer, {})
      ]
    }), 'leading', 'centerLeading');
  }

  return renderHomeWidgetShell(renderEventList(3, false), 'leading', 'topLeading');
}`;

const yohakuTodayWidgetLayout = createYohakuWidgetLayout('today');
const yohakuCalendarWidgetLayout = createYohakuWidgetLayout('calendar');
const yohakuTimelineWidgetLayout = createYohakuWidgetLayout('timeline');
const yohakuLockTasksWidgetLayout = createYohakuWidgetLayout('lockTasks');
const yohakuLockCalendarWidgetLayout = createYohakuWidgetLayout('lockCalendar');

const Widget = createWidget<YohakuTodayWidgetProps>(
  'YohakuTodayWidget',
  yohakuTodayWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

export const YohakuMediumWidget = createWidget<YohakuTodayWidgetProps>(
  'YohakuMediumWidget',
  yohakuTodayWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

export const YohakuLargeWidget = createWidget<YohakuTodayWidgetProps>(
  'YohakuLargeWidget',
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

export const YohakuLockTasksWidget = createWidget<YohakuTodayWidgetProps>(
  'YohakuLockTasksWidget',
  yohakuLockTasksWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

export const YohakuLockCalendarWidget = createWidget<YohakuTodayWidgetProps>(
  'YohakuLockCalendarWidget',
  yohakuLockCalendarWidgetLayout as unknown as YohakuTodayWidgetRenderer
);

const initialWidgetProps: YohakuTodayWidgetProps = {
  dateLabel: 'Today',
  monthLabel: '',
  themeBackground: '#FFFFFF',
  themeSurface: '#F7F7F5',
  themeBorder: '#E8E8E5',
  themeDot: '#D7D7D3',
  calendarDays: [],
  events: [],
  timelineEvents: [],
  totalCount: 0,
};

[
  Widget,
  YohakuMediumWidget,
  YohakuLargeWidget,
  YohakuCalendarWidget,
  YohakuTimelineWidget,
  YohakuLockTasksWidget,
  YohakuLockCalendarWidget,
].forEach((widget) => widget.updateSnapshot(initialWidgetProps));

export default Widget;
