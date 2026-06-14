import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

type ViewMode = 'month' | 'day' | 'detail';

type CalendarDay = {
  date: string;
  muted?: boolean;
  hasEvent?: boolean;
  selected?: boolean;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  memo?: string;
};

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

const monthDays: CalendarDay[] = [
  { date: '27', muted: true },
  { date: '28', muted: true },
  { date: '29', muted: true },
  { date: '30', muted: true },
  { date: '1' },
  { date: '2' },
  { date: '3' },
  { date: '4' },
  { date: '5' },
  { date: '6' },
  { date: '7', hasEvent: true },
  { date: '8' },
  { date: '9' },
  { date: '10' },
  { date: '11' },
  { date: '12', hasEvent: true },
  { date: '13' },
  { date: '14' },
  { date: '15' },
  { date: '16', hasEvent: true },
  { date: '17' },
  { date: '18' },
  { date: '19' },
  { date: '20', selected: true },
  { date: '21', hasEvent: true },
  { date: '22' },
  { date: '23' },
  { date: '24' },
  { date: '25' },
  { date: '26' },
  { date: '27' },
  { date: '28', hasEvent: true },
  { date: '29' },
  { date: '30' },
  { date: '31', hasEvent: true },
  { date: '1', muted: true },
  { date: '2', muted: true },
  { date: '3', muted: true },
  { date: '4', muted: true },
  { date: '5', muted: true },
  { date: '6', muted: true },
  { date: '7', muted: true },
];

const events: CalendarEvent[] = [
  {
    id: 'meeting',
    title: '打ち合わせ',
    start: '10:00',
    end: '11:00',
    location: '会議室A',
    memo: 'プロジェクトの進捗確認と\n今後の進め方について。',
  },
  {
    id: 'review',
    title: '企画レビュー',
    start: '14:00',
    end: '15:30',
    location: '会議室B',
  },
  {
    id: 'dinner',
    title: '夕食',
    start: '19:00',
    end: '20:30',
  },
];

const hours = [
  '8:00',
  '9:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

export default function App() {
  const [mode, setMode] = useState<ViewMode>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent>(events[0]);
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const headerTitle = useMemo(() => {
    if (mode === 'month') {
      return '2025年5月';
    }

    if (mode === 'day') {
      return '5月20日（火）';
    }

    return '';
  }, [mode]);

  const openEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setMode('detail');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.page, compact && styles.pageCompact]}>
        <Header
          title={headerTitle}
          canGoBack={mode !== 'month'}
          onBack={() => setMode(mode === 'detail' ? 'day' : 'month')}
        />

        {mode === 'month' && (
          <MonthScreen
            compact={compact}
            onSelectDate={() => setMode('day')}
            onSelectEvent={openEvent}
          />
        )}

        {mode === 'day' && <DayScreen onSelectEvent={openEvent} />}

        {mode === 'detail' && <DetailScreen event={selectedEvent} />}

        {mode !== 'detail' && (
          <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>＋</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Header({
  title,
  canGoBack,
  onBack,
}: {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      {canGoBack ? (
        <Pressable onPress={onBack} hitSlop={18} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.headerAction}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
      )}

      <Text style={styles.headerTitle}>{title}</Text>

      <Pressable hitSlop={18} style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.headerMore}>…</Text>
      </Pressable>
    </View>
  );
}

function MonthScreen({
  compact,
  onSelectDate,
  onSelectEvent,
}: {
  compact: boolean;
  onSelectDate: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  return (
    <View style={styles.monthScreen}>
      <View style={styles.weekRow}>
        {weekdays.map((weekday) => (
          <Text key={weekday} style={styles.weekday}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={[styles.calendarGrid, compact && styles.calendarGridCompact]}>
        {monthDays.map((day, index) => (
          <Pressable
            key={`${day.date}-${index}`}
            onPress={day.selected ? onSelectDate : undefined}
            style={styles.dateCell}
          >
            <View style={[styles.dateCircle, day.selected && styles.selectedDateCircle]}>
              <Text style={[styles.dateText, day.muted && styles.mutedDateText]}>{day.date}</Text>
            </View>
            <View style={styles.dotContainer}>
              {day.hasEvent && <View style={styles.eventDot} />}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionLine} />

      <View style={styles.scheduleList}>
        <Text style={styles.selectedDateText}>5月20日（火）</Text>
        {events.map((event) => (
          <ScheduleRow key={event.id} event={event} onPress={() => onSelectEvent(event)} />
        ))}
      </View>
    </View>
  );
}

function ScheduleRow({
  event,
  onPress,
}: {
  event: CalendarEvent;
  onPress: () => void;
}) {
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

function DayScreen({ onSelectEvent }: { onSelectEvent: (event: CalendarEvent) => void }) {
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
          {['18', '19', '20', '21', '22', '23', '24'].map((day) => (
            <View key={day} style={styles.dayStripCell}>
              <View style={[styles.dayStripCircle, day === '20' && styles.selectedDateCircle]}>
                <Text style={styles.dayStripText}>{day}</Text>
              </View>
              <View style={styles.dotContainer}>
                {day === '21' && <View style={styles.eventDot} />}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.timeline}>
        {hours.map((hour) => (
          <View key={hour} style={styles.hourRow}>
            <Text style={styles.hourText}>{hour}</Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        <TimelineEvent event={events[0]} top={70} height={56} onPress={() => onSelectEvent(events[0])} />
        <TimelineEvent event={events[1]} top={178} height={64} onPress={() => onSelectEvent(events[1])} />
        <TimelineEvent event={events[2]} top={326} height={64} onPress={() => onSelectEvent(events[2])} />
      </View>
    </View>
  );
}

function TimelineEvent({
  event,
  top,
  height,
  onPress,
}: {
  event: CalendarEvent;
  top: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.timelineEvent, { top, height }, pressed && styles.pressed]}
    >
      <Text style={styles.timelineTime}>{event.start}</Text>
      <Text style={styles.timelineTitle}>{event.title}</Text>
      <Text style={styles.timelineTime}>{event.end}</Text>
    </Pressable>
  );
}

function DetailScreen({ event }: { event: CalendarEvent }) {
  return (
    <ScrollView
      style={styles.detailScreen}
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.detailTitle}>{event.title}</Text>
      <Text style={styles.detailMeta}>2025年5月20日（火）</Text>
      <Text style={styles.detailMeta}>
        {event.start} - {event.end}
      </Text>

      {event.location ? <Text style={styles.detailText}>{event.location}</Text> : null}
      {event.memo ? <Text style={styles.detailText}>{event.memo}</Text> : null}

      <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
        <Text style={styles.editButtonText}>編集</Text>
      </Pressable>
    </ScrollView>
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
  accent: '#DCDCD8',
  selected: '#EFEFED',
  eventBlock: '#F4F4F2',
  dot: '#8E8E89',
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
  headerSide: {
    width: 24,
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
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
  },
  headerMore: {
    width: 24,
    color: tokens.secondaryText,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
    textAlign: 'right',
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
  editButton: {
    width: 80,
    height: 34,
    borderRadius: 12,
    borderColor: tokens.divider,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
  },
  editButtonText: {
    color: tokens.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.58,
  },
});
