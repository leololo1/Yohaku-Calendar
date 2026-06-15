import 'expo-sqlite/localStorage/install';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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

type ViewMode = 'month' | 'day' | 'detail' | 'form';
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
const hours = ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

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

const formatMonthTitle = (date: Date) => `${date.getFullYear()}年${date.getMonth() + 1}月`;

const formatDateTitle = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
};

const formatFullDate = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

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
  const monthDays = useMemo(() => createMonthDays(visibleMonth, selectedDate, events), [events, selectedDate, visibleMonth]);

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

    if (mode === 'day') {
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

  const openEvent = (event: CalendarEvent) => {
    setSelectedEventId(event.id);
    setSelectedDate(event.date);
    setVisibleMonth(new Date(parseDateKey(event.date).getFullYear(), parseDateKey(event.date).getMonth(), 1));
    setMode('detail');
  };

  const openAddForm = () => {
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
      setMode('day');
      return;
    }

    if (mode === 'form') {
      setMode(formMode === 'edit' ? 'detail' : 'month');
      return;
    }

    setMode('month');
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
    setMode('day');
  };

  const jumpToday = () => {
    const today = new Date();
    selectDate(today, 'month');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.page, compact && styles.pageCompact]}>
        <Header
          title={headerTitle}
          canGoBack={mode !== 'month'}
          canChangeMonth={mode === 'month'}
          onBack={back}
          onOpenMonthPicker={() => setMonthPickerVisible(true)}
          onToday={jumpToday}
        />

        {mode === 'month' && (
          <MonthScreen
            compact={compact}
            days={monthDays}
            events={selectedDateEvents}
            selectedDate={selectedDate}
            onSelectDate={(date) => selectDate(date)}
            onSwipeMonth={moveVisibleMonth}
            onOpenDay={() => setMode('day')}
            onSelectEvent={openEvent}
          />
        )}

        {mode === 'day' && (
          <DayScreen
            selectedDate={selectedDate}
            events={selectedDateEvents}
            allEvents={events}
            onSelectDate={(date) => selectDate(date, 'day')}
            onSelectEvent={openEvent}
          />
        )}

        {mode === 'detail' && selectedEvent && <DetailScreen event={selectedEvent} onEdit={() => openEditForm(selectedEvent)} onDelete={() => deleteEvent(selectedEvent.id)} />}

        {mode === 'form' && <EventForm draft={draft} onChange={setDraft} onSave={saveEvent} />}

        {(mode === 'month' || mode === 'day') && (
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
  canChangeMonth,
  onBack,
  onOpenMonthPicker,
  onToday,
}: {
  title: string;
  canGoBack: boolean;
  canChangeMonth: boolean;
  onBack: () => void;
  onOpenMonthPicker: () => void;
  onToday: () => void;
}) {
  return (
    <View style={styles.header}>
      {canGoBack ? (
        <Pressable onPress={onBack} hitSlop={18} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.headerAction}>‹</Text>
        </Pressable>
      ) : canChangeMonth ? (
        <Pressable onPress={onOpenMonthPicker} hitSlop={12} style={({ pressed }) => [styles.monthTitleButton, pressed && styles.pressed]}>
          <Text style={styles.headerTitle}>{title}</Text>
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
      )}

      {!canChangeMonth ? <Text style={styles.headerTitle}>{title}</Text> : null}

      {canChangeMonth ? (
        <View style={styles.headerActions}>
          <Pressable onPress={onToday} hitSlop={14} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.todayText}>今日</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.headerSide} />
      )}
    </View>
  );
}

function MonthScreen({
  compact,
  days,
  events,
  selectedDate,
  onSelectDate,
  onSwipeMonth,
  onOpenDay,
  onSelectEvent,
}: {
  compact: boolean;
  days: CalendarDay[];
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: Date) => void;
  onSwipeMonth: (amount: number) => void;
  onOpenDay: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -48) {
            onSwipeMonth(1);
          }

          if (gesture.dx >= 48) {
            onSwipeMonth(-1);
          }
        },
      }),
    [onSwipeMonth],
  );

  return (
    <View style={styles.monthScreen}>
      <View {...panResponder.panHandlers}>
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

      <View style={styles.sectionLine} />

      <View style={styles.scheduleList}>
        <Pressable onPress={onOpenDay} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.selectedDateText}>{formatDateTitle(selectedDate)}</Text>
        </Pressable>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>予定はありません</Text>
        ) : (
          events.map((event) => <ScheduleRow key={event.id} event={event} onPress={() => onSelectEvent(event)} />)
        )}
      </View>
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

function DayScreen({
  selectedDate,
  events,
  allEvents,
  onSelectDate,
  onSelectEvent,
}: {
  selectedDate: string;
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const selected = parseDateKey(selectedDate);
  const stripDays = Array.from({ length: 7 }, (_, index) => addDays(selected, index - 2));

  return (
    <View style={styles.dayScreen}>
      <View style={styles.dayMiniCalendar}>
        <View style={styles.weekRow}>
          {weekdays.map((weekday) => (
            <Text key={weekday} style={styles.weekday}>
              {weekday}
            </Text>
          ))}
        </View>
        <View style={styles.dayStrip}>
          {stripDays.map((day) => {
            const key = toDateKey(day);
            const selectedDay = key === selectedDate;

            return (
              <Pressable key={key} onPress={() => onSelectDate(day)} style={styles.dayStripCell}>
                <View style={[styles.dayStripCircle, selectedDay && styles.selectedDateCircle]}>
                  <Text style={styles.dayStripText}>{day.getDate()}</Text>
                </View>
                <View style={styles.dotContainer}>{!selectedDay && allEvents.some((event) => event.date === key) && <View style={styles.eventDot} />}</View>
              </Pressable>
            );
          })}
        </View>
      </View>

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
    </View>
  );
}

function TimelineEvent({ event, onPress }: { event: CalendarEvent; onPress: () => void }) {
  const start = minutesFromTime(event.start);
  const end = minutesFromTime(event.end);
  const top = 16 + Math.max(0, ((start - 8 * 60) / 60) * 40);
  const height = Math.max(38, ((end - start) / 60) * 40);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.timelineEvent, { top, height }, pressed && styles.pressed]}>
      <Text style={styles.timelineTime}>{event.start}</Text>
      <Text style={styles.timelineTitle}>{event.title}</Text>
      <Text style={styles.timelineTime}>{event.end}</Text>
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
    paddingTop: 58,
  },
  pageCompact: {
    paddingTop: 48,
  },
  header: {
    height: 50,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitleButton: {
    minWidth: 120,
    height: 34,
    justifyContent: 'center',
  },
  headerSide: {
    width: 52,
  },
  headerActions: {
    width: 72,
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
  headerNext: {
    color: tokens.secondaryText,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  headerTitle: {
    color: tokens.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    textAlign: 'left',
  },
  todayText: {
    color: tokens.secondaryText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  monthScreen: {
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingTop: 24,
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
    paddingTop: 22,
    rowGap: 22,
  },
  calendarGridCompact: {
    rowGap: 17,
  },
  dateCell: {
    width: `${100 / 7}%`,
    height: 43,
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
    marginTop: 14,
  },
  scheduleList: {
    paddingHorizontal: 30,
    paddingTop: 22,
  },
  selectedDateText: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    marginBottom: 14,
  },
  scheduleRow: {
    minHeight: 64,
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
  dayScreen: {
    flex: 1,
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
  timeline: {
    flex: 1,
    position: 'relative',
    paddingTop: 16,
    paddingLeft: 24,
    paddingRight: 24,
  },
  hourRow: {
    height: 40,
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
    marginTop: 5,
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
    marginVertical: 2,
  },
  timelineTime: {
    color: tokens.secondaryText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  timelineEmpty: {
    position: 'absolute',
    top: 84,
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
