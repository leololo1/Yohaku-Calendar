import 'expo-sqlite/localStorage/install';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type CalendarMode = 'month' | 'week';
type ViewMode = CalendarMode | 'detail' | 'form';
type FormMode = 'add' | 'edit';

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  location?: string;
  memo?: string;
  notification?: string;
};

type CalendarDay = {
  key: string;
  date: Date;
  label: string;
  muted: boolean;
  hasEvent: boolean;
  selected: boolean;
};

type EventDraft = {
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  memo: string;
  notification: string;
};

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
const hours = Array.from({ length: 24 }, (_, index) => `${index}:00`);
const hourHeight = 52;

const initialEvents: CalendarEvent[] = [
  {
    id: 'meeting',
    title: '打ち合わせ',
    date: '2025-05-20',
    start: '10:00',
    end: '11:00',
    location: '会議室A',
    memo: 'プロジェクトの進捗確認と\n今後の進め方について。',
    notification: '10分前',
  },
  {
    id: 'review',
    title: '企画レビュー',
    date: '2025-05-20',
    start: '14:00',
    end: '15:30',
    location: '会議室B',
  },
  {
    id: 'dinner',
    title: '夕食',
    date: '2025-05-20',
    start: '19:00',
    end: '20:30',
  },
  {
    id: 'sync',
    title: '確認',
    date: '2025-05-21',
    start: '11:00',
    end: '11:30',
  },
];

const eventStorageKey = 'yohaku-calendar-events';

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatMonthTitle = (date: Date) => `${date.getFullYear()}.${date.getMonth() + 1}`;

const formatDateTitle = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
};

const formatFullDate = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const startOfWeek = (date: Date) => addDays(date, -date.getDay());

const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const minutesFromTime = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }

  return hour * 60 + minute;
};

const isTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

const sortEvents = (items: CalendarEvent[]) =>
  [...items].sort((first, second) => minutesFromTime(first.start) - minutesFromTime(second.start));

const emptyDraft = (date: string): EventDraft => ({
  title: '',
  date,
  start: '10:00',
  end: '11:00',
  location: '',
  memo: '',
  notification: '',
});

const draftFromEvent = (event: CalendarEvent): EventDraft => ({
  title: event.title,
  date: event.date,
  start: event.start,
  end: event.end,
  location: event.location ?? '',
  memo: event.memo ?? '',
  notification: event.notification ?? '',
});

const createMonthDays = (visibleMonth: Date, selectedDate: string, events: CalendarEvent[]): CalendarDay[] => {
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const lastDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const start = addDays(firstDay, -firstDay.getDay());
  const end = addDays(lastDay, 6 - lastDay.getDay());
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(start, index);
    const key = toDateKey(date);

    return {
      key,
      date,
      label: String(date.getDate()),
      muted: date.getMonth() !== visibleMonth.getMonth(),
      hasEvent: events.some((event) => event.date === key),
      selected: key === selectedDate,
    };
  });
};

export default function App() {
  const [mode, setMode] = useState<ViewMode>('month');
  const [lastCalendarMode, setLastCalendarMode] = useState<CalendarMode>('month');
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [selectedDate, setSelectedDate] = useState('2025-05-20');
  const [visibleMonth, setVisibleMonth] = useState(new Date(2025, 4, 1));
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState(initialEvents[0].id);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft('2025-05-20'));
  const [storageReady, setStorageReady] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedDateEvents = useMemo(
    () => sortEvents(events.filter((event) => event.date === selectedDate)),
    [events, selectedDate],
  );

  useEffect(() => {
    const savedEvents = localStorage.getItem(eventStorageKey);

    if (savedEvents) {
      try {
        const parsedEvents = JSON.parse(savedEvents) as CalendarEvent[];
        if (Array.isArray(parsedEvents)) {
          setEvents(sortEvents(parsedEvents));
          setSelectedEventId(parsedEvents[0]?.id ?? '');
        }
      } catch {
        localStorage.removeItem(eventStorageKey);
      }
    }

    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    localStorage.setItem(eventStorageKey, JSON.stringify(events));
  }, [events, storageReady]);

  const headerTitle = useMemo(() => {
    if (mode === 'month') {
      return formatMonthTitle(visibleMonth);
    }

    if (mode === 'week') {
      return formatDateTitle(selectedDate);
    }

    if (mode === 'form') {
      return formMode === 'add' ? '予定を追加' : '予定を編集';
    }

    return '';
  }, [formMode, mode, selectedDate, visibleMonth]);

  const selectDate = (date: Date, nextMode: ViewMode = 'month') => {
    const key = toDateKey(date);
    setSelectedDate(key);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    if (nextMode === 'month' || nextMode === 'week') {
      setLastCalendarMode(nextMode);
    }
    setMode(nextMode);
  };

  const selectVisibleMonth = (date: Date) => {
    const selected = parseDateKey(selectedDate);
    const nextMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const nextDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selected.getDate(), daysInMonth(nextMonth)));

    setVisibleMonth(nextMonth);
    setSelectedDate(toDateKey(nextDate));
  };

  const moveVisibleMonth = (amount: number) => {
    selectVisibleMonth(addMonths(visibleMonth, amount));
  };

  const moveSelectedWeek = (amount: number) => {
    selectDate(addDays(parseDateKey(selectedDate), amount * 7), 'week');
  };

  const openEvent = (event: CalendarEvent) => {
    if (mode === 'month' || mode === 'week') {
      setLastCalendarMode(mode);
    }
    setSelectedEventId(event.id);
    setSelectedDate(event.date);
    setVisibleMonth(new Date(parseDateKey(event.date).getFullYear(), parseDateKey(event.date).getMonth(), 1));
    setMode('detail');
  };

  const openAddForm = () => {
    if (mode === 'month' || mode === 'week') {
      setLastCalendarMode(mode);
    }
    setFormMode('add');
    setDraft(emptyDraft(selectedDate));
    setMode('form');
  };

  const openEditForm = (event: CalendarEvent) => {
    setFormMode('edit');
    setSelectedEventId(event.id);
    setDraft(draftFromEvent(event));
    setMode('form');
  };

  const back = () => {
    if (mode === 'detail') {
      setMode(lastCalendarMode);
      return;
    }

    if (mode === 'form') {
      setMode(formMode === 'edit' ? 'detail' : lastCalendarMode);
      return;
    }

    setMode('month');
  };

  const changeCalendarMode = (nextMode: CalendarMode) => {
    if (mode === nextMode) {
      return;
    }

    setMode(nextMode);
    setLastCalendarMode(nextMode);
  };

  const saveEvent = () => {
    const title = draft.title.trim();
    const date = draft.date.trim();
    const start = draft.start.trim();
    const end = draft.end.trim();

    if (!title) {
      Alert.alert('タイトルを入力してください');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('日付は YYYY-MM-DD で入力してください');
      return;
    }

    if (!isTime(start) || !isTime(end)) {
      Alert.alert('時刻は HH:MM で入力してください');
      return;
    }

    if (minutesFromTime(start) >= minutesFromTime(end)) {
      Alert.alert('終了時刻は開始時刻より後にしてください');
      return;
    }

    const savedEvent: CalendarEvent = {
      id: formMode === 'add' ? `event-${Date.now()}` : selectedEventId,
      title,
      date,
      start,
      end,
      location: draft.location.trim() || undefined,
      memo: draft.memo.trim() || undefined,
      notification: draft.notification.trim() || undefined,
    };

    setEvents((current) => {
      if (formMode === 'add') {
        return sortEvents([...current, savedEvent]);
      }

      return sortEvents(current.map((event) => (event.id === selectedEventId ? savedEvent : event)));
    });
    setSelectedDate(savedEvent.date);
    setVisibleMonth(new Date(parseDateKey(savedEvent.date).getFullYear(), parseDateKey(savedEvent.date).getMonth(), 1));
    setSelectedEventId(savedEvent.id);
    setMode('detail');
  };

  const deleteEvent = (eventId: string) => {
    setEvents((current) => current.filter((event) => event.id !== eventId));
    setSelectedEventId('');
    setMode(lastCalendarMode);
  };

  const jumpToday = () => {
    const today = new Date();
    selectDate(today, mode === 'week' ? 'week' : 'month');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.page, compact && styles.pageCompact]}>
        <Header
          title={headerTitle}
          canGoBack={mode === 'detail' || mode === 'form'}
          canPickMonth={mode === 'month'}
          showCalendarActions={mode === 'month' || mode === 'week'}
          calendarMode={mode === 'week' ? 'week' : 'month'}
          onBack={back}
          onOpenMonthPicker={() => setMonthPickerVisible(true)}
          onChangeCalendarMode={changeCalendarMode}
          onToday={jumpToday}
        />

        {mode === 'month' && (
          <View style={styles.calendarLayer}>
            <MonthScreen
              compact={compact}
              viewportWidth={width}
              visibleMonth={visibleMonth}
              allEvents={events}
              events={selectedDateEvents}
              selectedDate={selectedDate}
              onSelectDate={(date) => selectDate(date)}
              onSwipeMonth={moveVisibleMonth}
              onOpenWeek={() => {
                setLastCalendarMode('week');
                setMode('week');
              }}
              onSelectEvent={openEvent}
            />
          </View>
        )}

        {mode === 'week' && (
          <View style={styles.calendarLayer}>
            <WeekScreen
              viewportWidth={width}
              selectedDate={selectedDate}
              events={selectedDateEvents}
              allEvents={events}
              onSelectDate={(date) => selectDate(date, 'week')}
              onSwipeWeek={moveSelectedWeek}
              onSelectEvent={openEvent}
            />
          </View>
        )}

        {mode === 'detail' && selectedEvent && <DetailScreen event={selectedEvent} onEdit={() => openEditForm(selectedEvent)} onDelete={() => deleteEvent(selectedEvent.id)} />}

        {mode === 'form' && <EventForm draft={draft} onChange={setDraft} onSave={saveEvent} />}

        {(mode === 'month' || mode === 'week') && (
          <Pressable onPress={openAddForm} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>＋</Text>
          </Pressable>
        )}

        <MonthPicker
          visible={monthPickerVisible}
          value={visibleMonth}
          onClose={() => setMonthPickerVisible(false)}
          onSelect={(date) => {
            selectVisibleMonth(date);
            setMonthPickerVisible(false);
          }}
        />
      </View>
    </View>
  );
}

function Header({
  title,
  canGoBack,
  canPickMonth,
  showCalendarActions,
  calendarMode,
  onBack,
  onOpenMonthPicker,
  onChangeCalendarMode,
  onToday,
}: {
  title: string;
  canGoBack: boolean;
  canPickMonth: boolean;
  showCalendarActions: boolean;
  calendarMode: CalendarMode;
  onBack: () => void;
  onOpenMonthPicker: () => void;
  onChangeCalendarMode: (mode: CalendarMode) => void;
  onToday: () => void;
}) {
  return (
    <View style={styles.header}>
      {canGoBack ? (
        <Pressable onPress={onBack} hitSlop={18} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.headerAction}>‹</Text>
        </Pressable>
      ) : canPickMonth ? (
        <Pressable onPress={onOpenMonthPicker} hitSlop={12} style={({ pressed }) => [styles.monthTitleButton, pressed && styles.pressed]}>
          <Text style={styles.headerTitle}>{title}</Text>
        </Pressable>
      ) : showCalendarActions ? (
        <View style={styles.monthTitleButton}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      ) : (
        <View style={styles.headerSide} />
      )}

      {!showCalendarActions && !canPickMonth ? <Text style={styles.headerTitle}>{title}</Text> : null}

      {showCalendarActions ? (
        <View style={styles.headerActions}>
          <Pressable onPress={onToday} hitSlop={14} style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}>
            <TodayIcon />
          </Pressable>
          <View style={styles.modeSegment}>
            <Pressable
              onPress={() => onChangeCalendarMode('month')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.modeSegmentButton,
                calendarMode === 'month' && styles.modeSegmentButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <MonthIcon />
            </Pressable>
            <Pressable
              onPress={() => onChangeCalendarMode('week')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.modeSegmentButton,
                calendarMode === 'week' && styles.modeSegmentButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <WeekIcon />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.headerSide} />
      )}
    </View>
  );
}

function MonthIcon() {
  return (
    <View style={styles.monthGridIcon}>
      {Array.from({ length: 9 }, (_, index) => (
        <View key={index} style={styles.monthGridDot} />
      ))}
    </View>
  );
}

function WeekIcon() {
  return (
    <View style={styles.weekLineIcon}>
      {Array.from({ length: 3 }, (_, index) => (
        <View key={index} style={styles.weekLine} />
      ))}
    </View>
  );
}

function TodayIcon() {
  return (
    <View style={styles.todayIcon}>
      <View style={styles.todayIconRingLeft} />
      <View style={styles.todayIconRingRight} />
      <View style={styles.todayIconTopLine} />
    </View>
  );
}

function MonthScreen({
  compact,
  viewportWidth,
  visibleMonth,
  allEvents,
  events,
  selectedDate,
  onSelectDate,
  onSwipeMonth,
  onOpenWeek,
  onSelectEvent,
}: {
  compact: boolean;
  viewportWidth: number;
  visibleMonth: Date;
  allEvents: CalendarEvent[];
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: Date) => void;
  onSwipeMonth: (amount: number) => void;
  onOpenWeek: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const pageBuffer = 18;
  const pageOffsets = useMemo(() => Array.from({ length: pageBuffer * 2 + 1 }, (_, index) => index - pageBuffer), []);
  const [anchorMonth, setAnchorMonth] = useState(visibleMonth);
  const [pageIndex, setPageIndex] = useState(0);
  const [slideX] = useState(() => new Animated.Value(-pageBuffer * viewportWidth));
  const currentMonth = addMonths(anchorMonth, pageIndex);
  const currentMonthKey = monthKey(currentMonth);
  const currentPageX = -(pageBuffer + pageIndex) * viewportWidth;
  const monthPages = useMemo(
    () => pageOffsets.map((offset) => createMonthDays(addMonths(anchorMonth, offset), selectedDate, allEvents)),
    [allEvents, anchorMonth, pageOffsets, selectedDate],
  );

  useEffect(() => {
    if (monthKey(visibleMonth) === currentMonthKey) {
      return;
    }

    setAnchorMonth(visibleMonth);
    setPageIndex(0);
    slideX.setValue(-pageBuffer * viewportWidth);
  }, [currentMonthKey, slideX, viewportWidth, visibleMonth]);

  const slideMonth = (amount: number) => {
    const targetX = -(pageBuffer + pageIndex + amount) * viewportWidth;

    Animated.timing(slideX, {
      toValue: targetX,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setPageIndex((current) => current + amount);
      onSwipeMonth(amount);
    });
  };

  const returnMonth = () => {
    Animated.timing(slideX, {
      toValue: currentPageX,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          slideX.setValue(currentPageX + gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -viewportWidth * 0.22 || gesture.vx < -0.45) {
            slideMonth(1);
            return;
          }

          if (gesture.dx >= viewportWidth * 0.22 || gesture.vx > 0.45) {
            slideMonth(-1);
            return;
          }

          returnMonth();
        },
        onPanResponderTerminate: returnMonth,
      }),
    [currentPageX, returnMonth, slideMonth, slideX, viewportWidth],
  );

  return (
    <View style={styles.monthScreen}>
      <View style={styles.horizontalViewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.horizontalPages,
            {
              width: viewportWidth * monthPages.length,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          {monthPages.map((days, pageIndex) => (
            <View key={pageIndex} style={{ width: viewportWidth }}>
              <View style={styles.weekRow}>
                {weekdays.map((weekday) => (
                  <Text key={weekday} style={styles.weekday}>
                    {weekday}
                  </Text>
                ))}
              </View>

              <View style={[styles.calendarGrid, compact && styles.calendarGridCompact]}>
                {days.map((day) => (
                  <Pressable key={day.key} onPress={() => onSelectDate(day.date)} onLongPress={() => onSelectDate(day.date)} style={styles.dateCell}>
                    <View style={[styles.dateCircle, day.selected && styles.selectedDateCircle]}>
                      <Text style={[styles.dateText, day.muted && styles.mutedDateText]}>{day.label}</Text>
                    </View>
                    <View style={styles.dotContainer}>{day.hasEvent && <View style={styles.eventDot} />}</View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.sectionLine} />

      <ScrollView style={styles.scheduleScroll} contentContainerStyle={styles.scheduleList} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onOpenWeek} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.selectedDateText}>{formatDateTitle(selectedDate)}</Text>
        </Pressable>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>予定はありません</Text>
        ) : (
          events.map((event) => <ScheduleRow key={event.id} event={event} onPress={() => onSelectEvent(event)} />)
        )}
      </ScrollView>
    </View>
  );
}

function MonthPicker({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
}) {
  const [year, setYear] = useState(value.getFullYear());
  const [month, setMonth] = useState(value.getMonth());
  const years = useMemo(() => Array.from({ length: 21 }, (_, index) => value.getFullYear() - 10 + index), [value]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index), []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setYear(value.getFullYear());
    setMonth(value.getMonth());
  }, [value, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.pickerAction}>閉じる</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>年月</Text>
            <Pressable onPress={() => onSelect(new Date(year, month, 1))} hitSlop={14} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.pickerAction}>決定</Text>
            </Pressable>
          </View>

          <View style={styles.pickerColumns}>
            <ScrollView style={styles.pickerColumn} contentContainerStyle={styles.pickerColumnContent} showsVerticalScrollIndicator={false}>
              {years.map((item) => (
                <Pressable key={item} onPress={() => setYear(item)} style={styles.pickerItem}>
                  <Text style={[styles.pickerItemText, item === year && styles.pickerItemTextSelected]}>{item}年</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView style={styles.pickerColumn} contentContainerStyle={styles.pickerColumnContent} showsVerticalScrollIndicator={false}>
              {months.map((item) => (
                <Pressable key={item} onPress={() => setMonth(item)} style={styles.pickerItem}>
                  <Text style={[styles.pickerItemText, item === month && styles.pickerItemTextSelected]}>{item + 1}月</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ScheduleRow({ event, onPress }: { event: CalendarEvent; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.scheduleRow, pressed && styles.pressed]}>
      <View style={styles.scheduleTime}>
        <Text style={styles.scheduleStart}>{event.start}</Text>
        <Text style={styles.scheduleEnd}>{event.end}</Text>
      </View>
      <Text style={styles.scheduleTitle}>{event.title}</Text>
    </Pressable>
  );
}

function WeekScreen({
  viewportWidth,
  selectedDate,
  events,
  allEvents,
  onSelectDate,
  onSwipeWeek,
  onSelectEvent,
}: {
  viewportWidth: number;
  selectedDate: string;
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onSwipeWeek: (amount: number) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const selected = parseDateKey(selectedDate);
  const pageBuffer = 18;
  const pageOffsets = useMemo(() => Array.from({ length: pageBuffer * 2 + 1 }, (_, index) => index - pageBuffer), []);
  const [anchorSelectedDate, setAnchorSelectedDate] = useState(selected);
  const [pageIndex, setPageIndex] = useState(0);
  const [slideX] = useState(() => new Animated.Value(-pageBuffer * viewportWidth));
  const currentSelectedDate = addDays(anchorSelectedDate, pageIndex * 7);
  const currentSelectedDateKey = toDateKey(currentSelectedDate);
  const currentPageX = -(pageBuffer + pageIndex) * viewportWidth;
  const weekPages = useMemo(() => pageOffsets.map((offset) => {
    const pageSelectedDate = addDays(anchorSelectedDate, offset * 7);
    const pageStart = startOfWeek(pageSelectedDate);
    const pageSelectedKey = toDateKey(pageSelectedDate);

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(pageStart, index);

      return {
        date,
        key: toDateKey(date),
        selected: toDateKey(date) === pageSelectedKey,
      };
    });
  }), [anchorSelectedDate, pageOffsets]);

  useEffect(() => {
    if (toDateKey(selected) === currentSelectedDateKey) {
      return;
    }

    setAnchorSelectedDate(selected);
    setPageIndex(0);
    slideX.setValue(-pageBuffer * viewportWidth);
  }, [currentSelectedDateKey, selected, slideX, viewportWidth]);

  const slideWeek = (amount: number) => {
    const targetX = -(pageBuffer + pageIndex + amount) * viewportWidth;

    Animated.timing(slideX, {
      toValue: targetX,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setPageIndex((current) => current + amount);
      onSwipeWeek(amount);
    });
  };

  const returnWeek = () => {
    Animated.timing(slideX, {
      toValue: currentPageX,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          slideX.setValue(currentPageX + gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -viewportWidth * 0.22 || gesture.vx < -0.45) {
            slideWeek(1);
            return;
          }

          if (gesture.dx >= viewportWidth * 0.22 || gesture.vx > 0.45) {
            slideWeek(-1);
            return;
          }

          returnWeek();
        },
        onPanResponderTerminate: returnWeek,
      }),
    [currentPageX, returnWeek, slideWeek, slideX, viewportWidth],
  );

  return (
    <View style={styles.weekScreen}>
      <View style={styles.weekSwipeArea} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.horizontalPages,
            {
              width: viewportWidth * weekPages.length,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          {weekPages.map((days, pageIndex) => (
            <View key={pageIndex} style={[styles.dayMiniCalendar, { width: viewportWidth }]}>
              <View style={styles.weekRow}>
                {weekdays.map((weekday) => (
                  <Text key={weekday} style={styles.weekday}>
                    {weekday}
                  </Text>
                ))}
              </View>
              <View style={styles.dayStrip}>
                {days.map((day) => (
                  <Pressable key={day.key} onPress={() => onSelectDate(day.date)} style={styles.dayStripCell}>
                    <View style={[styles.dayStripCircle, day.selected && styles.selectedDateCircle]}>
                      <Text style={styles.dayStripText}>{day.date.getDate()}</Text>
                    </View>
                    <View style={styles.dotContainer}>{!day.selected && allEvents.some((event) => event.date === day.key) && <View style={styles.eventDot} />}</View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <ScrollView style={styles.timelineScroll} contentContainerStyle={styles.timelineContent} showsVerticalScrollIndicator={false}>
        <View style={styles.timeline}>
          {hours.map((hour) => (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourText}>{hour}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}

          {events.map((event) => (
            <TimelineEvent key={event.id} event={event} onPress={() => onSelectEvent(event)} />
          ))}

          {events.length === 0 ? <Text style={styles.timelineEmpty}>予定はありません</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function TimelineEvent({ event, onPress }: { event: CalendarEvent; onPress: () => void }) {
  const start = minutesFromTime(event.start);
  const end = minutesFromTime(event.end);
  const top = Math.max(0, (start / 60) * hourHeight);
  const height = Math.max(36, ((end - start) / 60) * hourHeight);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.timelineEvent, { top, height }, pressed && styles.pressed]}>
      <Text style={styles.timelineTitle}>{event.title}</Text>
    </Pressable>
  );
}

function DetailScreen({
  event,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <ScrollView style={styles.detailScreen} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.detailTitle}>{event.title}</Text>
      <Text style={styles.detailMeta}>{formatFullDate(event.date)}</Text>
      <Text style={styles.detailMeta}>
        {event.start} - {event.end}
      </Text>

      {event.location ? <Text style={styles.detailText}>{event.location}</Text> : null}
      {event.memo ? <Text style={styles.detailText}>{event.memo}</Text> : null}
      {event.notification ? <Text style={styles.detailText}>{event.notification}</Text> : null}

      <View style={styles.detailActions}>
        <Pressable onPress={onEdit} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Text style={styles.editButtonText}>編集</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <Text style={styles.deleteButtonText}>削除</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function EventForm({
  draft,
  onChange,
  onSave,
}: {
  draft: EventDraft;
  onChange: (draft: EventDraft) => void;
  onSave: () => void;
}) {
  const update = (key: keyof EventDraft, value: string) => onChange({ ...draft, [key]: value });

  return (
    <ScrollView style={styles.formScreen} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <FormField label="タイトル" value={draft.title} onChangeText={(value) => update('title', value)} autoFocus />
      <FormField label="日付" value={draft.date} onChangeText={(value) => update('date', value)} placeholder="YYYY-MM-DD" />
      <View style={styles.timeFields}>
        <FormField label="開始" value={draft.start} onChangeText={(value) => update('start', value)} placeholder="10:00" compact />
        <FormField label="終了" value={draft.end} onChangeText={(value) => update('end', value)} placeholder="11:00" compact />
      </View>
      <FormField label="場所" value={draft.location} onChangeText={(value) => update('location', value)} />
      <FormField label="通知" value={draft.notification} onChangeText={(value) => update('notification', value)} placeholder="10分前" />
      <FormField label="メモ" value={draft.memo} onChangeText={(value) => update('memo', value)} multiline />

      <Pressable onPress={onSave} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
        <Text style={styles.saveButtonText}>保存</Text>
      </Pressable>
    </ScrollView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  compact,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View style={[styles.formField, compact && styles.formFieldCompact]}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.disabledText}
        multiline={multiline}
        style={[styles.formInput, multiline && styles.formInputMultiline]}
      />
    </View>
  );
}

const tokens = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  subtleSurface: '#F7F7F5',
  text: '#222222',
  secondaryText: '#777777',
  tertiaryText: '#AAAAAA',
  disabledText: '#CFCFCB',
  hairline: '#EEEEEA',
  divider: '#E6E6E2',
  selected: '#EFEFED',
  eventBlock: '#F4F4F2',
  dot: '#8E8E89',
  destructive: '#9B6A62',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  page: {
    flex: 1,
    backgroundColor: tokens.surface,
    paddingTop: 66,
  },
  pageCompact: {
    paddingTop: 56,
  },
  calendarLayer: {
    flex: 1,
  },
  header: {
    height: 58,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitleButton: {
    minWidth: 120,
    height: 42,
    justifyContent: 'center',
  },
  headerSide: {
    width: 52,
  },
  headerActions: {
    width: 132,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  headerAction: {
    width: 24,
    color: tokens.secondaryText,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  headerTitle: {
    color: tokens.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '400',
    textAlign: 'left',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8CBC2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegment: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.hairline,
    borderRadius: 18,
    backgroundColor: tokens.subtleSurface,
    padding: 2,
  },
  modeSegmentButton: {
    width: 34,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegmentButtonActive: {
    backgroundColor: tokens.selected,
  },
  monthGridIcon: {
    width: 15,
    height: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 2.5,
    columnGap: 2.5,
  },
  monthGridDot: {
    width: 3.2,
    height: 3.2,
    borderRadius: 1.6,
    backgroundColor: tokens.secondaryText,
  },
  weekLineIcon: {
    width: 16,
    height: 13,
    justifyContent: 'space-between',
  },
  weekLine: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: tokens.secondaryText,
  },
  todayIcon: {
    width: 18,
    height: 19,
    borderWidth: 1,
    borderColor: tokens.secondaryText,
    borderRadius: 4,
  },
  todayIconRingLeft: {
    position: 'absolute',
    top: -3,
    left: 4,
    width: 1,
    height: 5,
    backgroundColor: tokens.secondaryText,
  },
  todayIconRingRight: {
    position: 'absolute',
    top: -3,
    right: 4,
    width: 1,
    height: 5,
    backgroundColor: tokens.secondaryText,
  },
  todayIconTopLine: {
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: tokens.secondaryText,
  },
  monthScreen: {
    flex: 1,
  },
  horizontalViewport: {
    overflow: 'hidden',
  },
  horizontalPages: {
    flexDirection: 'row',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingTop: 34,
  },
  weekday: {
    flex: 1,
    color: tokens.tertiaryText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 27,
    paddingTop: 26,
    rowGap: 26,
  },
  calendarGridCompact: {
    rowGap: 21,
  },
  dateCell: {
    width: `${100 / 7}%`,
    height: 46,
    alignItems: 'center',
  },
  dateCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDateCircle: {
    backgroundColor: tokens.selected,
  },
  dateText: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  mutedDateText: {
    color: tokens.disabledText,
  },
  dotContainer: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: tokens.dot,
  },
  sectionLine: {
    height: 1,
    backgroundColor: tokens.hairline,
    marginTop: 24,
  },
  scheduleScroll: {
    flex: 1,
  },
  scheduleList: {
    paddingHorizontal: 30,
    paddingTop: 26,
    paddingBottom: 88,
  },
  selectedDateText: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    marginBottom: 14,
  },
  scheduleRow: {
    minHeight: 72,
    borderBottomColor: tokens.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleTime: {
    width: 62,
    gap: 5,
  },
  scheduleStart: {
    color: tokens.secondaryText,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  scheduleEnd: {
    color: tokens.tertiaryText,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  scheduleTitle: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  emptyText: {
    color: tokens.tertiaryText,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
    paddingTop: 22,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(250, 250, 248, 0.72)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: tokens.hairline,
    borderWidth: 1,
    paddingBottom: 34,
  },
  pickerHeader: {
    height: 54,
    paddingHorizontal: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: tokens.hairline,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  pickerAction: {
    color: tokens.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  pickerColumns: {
    height: 224,
    flexDirection: 'row',
    paddingHorizontal: 48,
    paddingTop: 16,
    gap: 28,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerColumnContent: {
    paddingVertical: 70,
  },
  pickerItem: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    color: tokens.tertiaryText,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  pickerItemTextSelected: {
    color: tokens.text,
    fontSize: 20,
    lineHeight: 26,
  },
  addButton: {
    position: 'absolute',
    right: 28,
    bottom: 34,
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: tokens.surface,
    borderColor: tokens.hairline,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.08)',
  },
  addButtonText: {
    color: tokens.secondaryText,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  weekScreen: {
    flex: 1,
  },
  weekSwipeArea: {
    overflow: 'hidden',
  },
  dayMiniCalendar: {
    borderBottomColor: tokens.hairline,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  dayStrip: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingTop: 12,
  },
  dayStripCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayStripCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStripText: {
    color: tokens.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingBottom: 52,
  },
  timeline: {
    height: hourHeight * 24,
    position: 'relative',
    paddingLeft: 24,
    paddingRight: 24,
  },
  hourRow: {
    height: hourHeight,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourText: {
    width: 44,
    color: tokens.tertiaryText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: tokens.hairline,
  },
  timelineEvent: {
    position: 'absolute',
    left: 74,
    right: 24,
    borderRadius: 10,
    backgroundColor: tokens.eventBlock,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  timelineTitle: {
    color: tokens.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  timelineEmpty: {
    position: 'absolute',
    top: hourHeight * 9,
    left: 74,
    color: tokens.tertiaryText,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  detailScreen: {
    flex: 1,
  },
  detailContent: {
    paddingHorizontal: 32,
    paddingTop: 90,
    paddingBottom: 48,
  },
  detailTitle: {
    color: tokens.text,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '400',
    marginBottom: 26,
  },
  detailMeta: {
    color: tokens.secondaryText,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  detailText: {
    color: tokens.secondaryText,
    fontSize: 13,
    lineHeight: 22,
    fontWeight: '400',
    marginTop: 28,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 36,
  },
  editButton: {
    width: 80,
    height: 34,
    borderRadius: 12,
    borderColor: tokens.divider,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: tokens.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  deleteButton: {
    width: 80,
    height: 34,
    borderRadius: 12,
    borderColor: tokens.divider,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: tokens.destructive,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  formScreen: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 32,
    paddingTop: 38,
    paddingBottom: 58,
    gap: 18,
  },
  formField: {
    gap: 8,
  },
  formFieldCompact: {
    flex: 1,
  },
  formLabel: {
    color: tokens.tertiaryText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  formInput: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: tokens.hairline,
    color: tokens.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    paddingVertical: 8,
  },
  formInputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  timeFields: {
    flexDirection: 'row',
    gap: 18,
  },
  saveButton: {
    width: 82,
    height: 34,
    borderRadius: 12,
    borderColor: tokens.divider,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: tokens.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.58,
  },
});
