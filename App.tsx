import 'expo-sqlite/localStorage/install';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { CloudStorage } from 'react-native-cloud-storage';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { YohakuTodayWidgetProps } from './widgets/YohakuTodayWidget';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  Switch,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

type CalendarMode = 'month';
type ViewMode = CalendarMode | 'form' | 'pro' | 'notificationSettings' | 'theme' | 'backup';
type FormMode = 'add' | 'edit';
type NotificationOption = 'none' | 'atStart' | 'before3' | 'before5' | 'before10' | 'before30' | 'before60';
type TimeFieldKey = 'start' | 'end';

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  start: string;
  end: string;
  location?: string;
  memo?: string;
  notification?: string;
  startNotifications?: NotificationOption[];
  endNotifications?: NotificationOption[];
};

type CalendarDay = {
  key: string;
  date: Date;
  label: string;
  muted: boolean;
  eventCount: number;
  selected: boolean;
};

type CalendarRenderState = {
  mode: CalendarMode;
  selectedDate: string;
  visibleMonth: Date;
  events: CalendarEvent[];
};

type EventDraft = {
  title: string;
  date: string;
  endDate: string;
  start: string;
  end: string;
  startNotifications: NotificationOption[];
  endNotifications: NotificationOption[];
};

type NotificationSettings = {
  eventNotificationsEnabled: boolean;
  soundEnabled: boolean;
};

type ThemePalette = {
  id: string;
  name: string;
  background: string;
  surface: string;
  border: string;
  dot: string;
};

type BackupPayload = {
  version: 1;
  exportedAt: string;
  events: CalendarEvent[];
  notificationSettings: NotificationSettings;
};

type ScheduleTimelineEntry = {
  event: CalendarEvent;
  start: number;
  end: number;
  column: number;
  columnSpan: number;
};

type ScheduleTimelineGroup = {
  id: string;
  start: number;
  end: number;
  columnCount: number;
  entries: ScheduleTimelineEntry[];
};

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
const appStoreAppId = '6780133048';
const appStoreShareUrl = `https://apps.apple.com/app/id${appStoreAppId}`;
const appStoreReviewUrl = `itms-apps://itunes.apple.com/app/id${appStoreAppId}?action=write-review`;
const appStoreReviewFallbackUrl = `${appStoreShareUrl}?action=write-review`;
const appleStandardEulaUrl = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const pickerColumnHeight = 224;
const pickerItemHeight = 38;
const schedulePixelsPerMinute = 1.05;
const scheduleMinCardHeight = 58;
const scheduleDefaultVisualDuration = 60;
const scheduleTimelineGroupGap = 4;
const notificationOptions: { value: NotificationOption; label: string }[] = [
  { value: 'none', label: 'なし' },
  { value: 'atStart', label: '開始時刻' },
  { value: 'before3', label: '3分前' },
  { value: 'before5', label: '5分前' },
  { value: 'before10', label: '10分前' },
  { value: 'before30', label: '30分前' },
  { value: 'before60', label: '1時間前' },
];
const switchColors = {
  trackOff: '#D8D8D4',
  trackOn: '#4F4F4B',
  thumbOff: '#FFFFFF',
  thumbOn: '#FFFFFF',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
const notificationSettingsStorageKey = 'yohaku-calendar-notification-settings';
const notificationPermissionPromptedStorageKey = 'yohaku-calendar-notification-permission-prompted';
const backupAutoEnabledStorageKey = 'yohaku-calendar-backup-auto-enabled';
const backupLastBackupAtStorageKey = 'yohaku-calendar-backup-last-at';
const themeStorageKey = 'yohaku-calendar-theme';
const iCloudBackupDirectory = '/yohaku-calendar';
const iCloudBackupPath = `${iCloudBackupDirectory}/backup.json`;
const notificationIdentifierPrefix = 'yohaku-calendar-event-';
const testNotificationIdentifierPrefix = 'yohaku-calendar-test-';
const defaultNotificationSettings: NotificationSettings = {
  eventNotificationsEnabled: true,
  soundEnabled: true,
};
const themePalettes: ThemePalette[] = [
  { id: 'pure-white', name: 'ピュアホワイト', background: '#FFFFFF', surface: '#F7F7F5', border: '#E8E8E5', dot: '#D7D7D3' },
  { id: 'soft-white', name: 'ソフトホワイト', background: '#FCFCFA', surface: '#F5F5F2', border: '#E6E6E1', dot: '#D3D3CD' },
  { id: 'paper-white', name: 'ペーパーホワイト', background: '#FAF8F3', surface: '#F2EFE8', border: '#E2DDD2', dot: '#CEC6B8' },
  { id: 'milk', name: 'ミルク', background: '#FBF8F2', surface: '#F3EEE5', border: '#E5DED2', dot: '#D2C7B8' },
  { id: 'ivory', name: 'アイボリー', background: '#FAF5EA', surface: '#F1E8D8', border: '#E1D5C0', dot: '#CDBB9F' },
  { id: 'mist-gray', name: 'ミストグレー', background: '#F7F8F7', surface: '#EFF0EE', border: '#DEDFDB', dot: '#C9CBC6' },
  { id: 'stone-gray', name: 'ストーングレー', background: '#F3F3F1', surface: '#EAEAE6', border: '#D8D8D2', dot: '#BFC0B8' },
  { id: 'ash', name: 'アッシュ', background: '#F4F5F4', surface: '#ECEEED', border: '#D9DDDC', dot: '#AEB9BC' },
  { id: 'snow', name: 'スノー', background: '#FBFCFD', surface: '#F2F5F7', border: '#E0E6EA', dot: '#C8D2D8' },
  { id: 'pearl', name: 'パール', background: '#FAFAFC', surface: '#F1F1F5', border: '#E1E1E8', dot: '#CACAD6' },
  { id: 'cloud', name: 'クラウド', background: '#F8FAFA', surface: '#EEF2F2', border: '#DDE4E4', dot: '#C5D0D0' },
  { id: 'fog', name: 'フォグ', background: '#F6F7F6', surface: '#EDEFED', border: '#DADDD9', dot: '#C3C8C1' },
  { id: 'cement', name: 'セメント', background: '#F1F1EF', surface: '#E7E7E3', border: '#D4D4CE', dot: '#B9B9AF' },
  { id: 'chalk', name: 'チョーク', background: '#FDFCF8', surface: '#F6F3EC', border: '#E6E0D4', dot: '#D0C5B2' },
  { id: 'oat', name: 'オート', background: '#F8F3EA', surface: '#EFE5D6', border: '#DED0BA', dot: '#C8B291' },
  { id: 'linen', name: 'リネン', background: '#F7F1E6', surface: '#EEE3D0', border: '#DCCBB0', dot: '#C2A986' },
  { id: 'sand', name: 'サンド', background: '#F5EDDF', surface: '#EADCC6', border: '#D6C0A0', dot: '#B99B73' },
  { id: 'warm-gray', name: 'ウォームグレー', background: '#F4F2EE', surface: '#EAE6DE', border: '#D8D1C5', dot: '#BEB3A3' },
  { id: 'taupe', name: 'トープ', background: '#F1EDE7', surface: '#E5DDD3', border: '#D0C4B6', dot: '#AFA091' },
  { id: 'mocha-gray', name: 'モカグレー', background: '#EEEAE4', surface: '#DFD7CD', border: '#C8BAAA', dot: '#A39180' },
  { id: 'silver', name: 'シルバー', background: '#F6F6F5', surface: '#EFEFEC', border: '#DCDCD7', dot: '#C4C4BD' },
  { id: 'platinum', name: 'プラチナ', background: '#F7F7F8', surface: '#EFEFF1', border: '#DDDEE2', dot: '#C4C6CC' },
  { id: 'light-slate', name: 'ライトスレート', background: '#F3F5F5', surface: '#EAEEEE', border: '#D6DDDD', dot: '#B8C2C2' },
  { id: 'blue-gray', name: 'ブルーグレー', background: '#F2F6F7', surface: '#E8EFF1', border: '#D2DEE2', dot: '#ADC1C8' },
  { id: 'moon', name: 'ムーン', background: '#F8F8FA', surface: '#F0F0F4', border: '#DEDFE7', dot: '#C5C7D3' },
  { id: 'lavender-gray', name: 'ラベンダーグレー', background: '#F8F7FA', surface: '#F0EEF4', border: '#DFDCE8', dot: '#C9C2D6' },
  { id: 'warm-snow', name: 'ウォームスノー', background: '#FEFCF8', surface: '#F7F2EA', border: '#E8DFD2', dot: '#D3C4B2' },
  { id: 'cream', name: 'クリーム', background: '#FBF4E8', surface: '#F1E3CB', border: '#DFCBAA', dot: '#C6A77A' },
  { id: 'vanilla', name: 'バニラ', background: '#FCF6EA', surface: '#F3E8D3', border: '#E3D2B3', dot: '#CAB08A' },
  { id: 'greige', name: 'グレージュ', background: '#F2EEE8', surface: '#E6DED4', border: '#D1C4B6', dot: '#B4A394' },
  { id: 'dry-gray', name: 'ドライグレー', background: '#F0F0ED', surface: '#E4E4DF', border: '#D0D0C8', dot: '#AFAFA5' },
  { id: 'milky-gray', name: 'ミルキーグレー', background: '#F7F7F4', surface: '#EFEFE9', border: '#DDDDD4', dot: '#C6C6BB' },
  { id: 'whisper', name: 'ウィスパー', background: '#FCFCFB', surface: '#F6F6F4', border: '#E9E9E5', dot: '#D8D8D1' },
  { id: 'soft-white-jp', name: 'ほの白', background: '#FFFDF9', surface: '#F8F3EA', border: '#E8DED0', dot: '#D1C0AA' },
];
const defaultTheme = themePalettes[0];
const notificationOffsets: Record<Exclude<NotificationOption, 'none'>, number> = {
  atStart: 0,
  before3: 3,
  before5: 5,
  before10: 10,
  before30: 30,
  before60: 60,
};

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

const formatShortDateTitle = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}.${date.getDate()}`;
};

const formatWidgetDateTitle = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}.${date.getDate()}`;
};

const formatWidgetMonthTitle = (date: Date) => `${date.getFullYear()}.${date.getMonth() + 1}`;

const formatFullDate = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
};

const parseValidDateKey = (dateKey: string, fallback: Date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return fallback;
  }

  const date = parseDateKey(dateKey);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

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

const formatTimelineTime = (minutes: number) => `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;

const eventEndDate = (event: CalendarEvent) => event.endDate ?? event.date;

const isMultiDayEvent = (event: CalendarEvent) => eventEndDate(event) !== event.date;

const eventOccursOnDate = (event: CalendarEvent, dateKey: string) => event.date <= dateKey && dateKey <= eventEndDate(event);

const eventDuration = (event: CalendarEvent) => Math.max(10, minutesFromTime(event.end) - minutesFromTime(event.start));

const visualDurationForMultiDayEvent = (events: CalendarEvent[], dateKey: string, eventId: string) => {
  const sameDayEvent = sortEvents(events).find((event) => event.id !== eventId && event.date === dateKey && eventEndDate(event) === dateKey);
  return sameDayEvent ? eventDuration(sameDayEvent) : scheduleDefaultVisualDuration;
};

const eventTimelineSegment = (event: CalendarEvent, dateKey: string, visualDuration = scheduleDefaultVisualDuration) => {
  const startsToday = event.date === dateKey;
  const endsToday = eventEndDate(event) === dateKey;
  const start = startsToday ? minutesFromTime(event.start) : 0;
  const spansMultipleDays = isMultiDayEvent(event);
  const end = spansMultipleDays ? start + visualDuration : endsToday ? minutesFromTime(event.end) : 24 * 60;

  return {
    start,
    end: Math.max(start + 10, end),
  };
};

const sortEventsForDate = (items: CalendarEvent[], dateKey: string) =>
  [...items].sort((first, second) => {
    const firstSegment = eventTimelineSegment(first, dateKey);
    const secondSegment = eventTimelineSegment(second, dateKey);
    return firstSegment.start - secondSegment.start || firstSegment.end - secondSegment.end;
  });

const formatScheduleEndLabel = (event: CalendarEvent) => {
  const endDate = eventEndDate(event);
  return endDate === event.date ? `~${event.end}` : `~${formatShortDateTitle(endDate)}\n${event.end}`;
};

const scheduleEntriesOverlap = (first: ScheduleTimelineEntry, second: ScheduleTimelineEntry) =>
  first.start < second.end && second.start < first.end;

const expandScheduleEntryColumns = (entries: ScheduleTimelineEntry[], columnCount: number) =>
  entries.map((entry) => {
    let columnSpan = 1;

    for (let column = entry.column + 1; column < columnCount; column += 1) {
      const columnIsOccupied = entries.some(
        (candidate) => candidate.column === column && scheduleEntriesOverlap(entry, candidate),
      );

      if (columnIsOccupied) break;
      columnSpan += 1;
    }

    return { ...entry, columnSpan };
  });

const buildScheduleTimelineGroups = (events: CalendarEvent[], dateKey: string): ScheduleTimelineGroup[] => {
  const sortedEvents = sortEventsForDate(events, dateKey);
  const groups: ScheduleTimelineGroup[] = [];
  const multiDayEvents = sortedEvents.filter(isMultiDayEvent);
  const singleDayEvents = sortedEvents.filter((event) => !isMultiDayEvent(event));

  if (multiDayEvents.length > 0 && singleDayEvents.length > 0) {
    const singleDaySegments = singleDayEvents.map((event) => ({
      event,
      ...eventTimelineSegment(event, dateKey),
    }));
    const singleDayGroups: ScheduleTimelineGroup[] = [];

    singleDaySegments.forEach((entry) => {
      const lastGroup = singleDayGroups[singleDayGroups.length - 1];

      if (!lastGroup || entry.start >= lastGroup.end) {
        singleDayGroups.push({
          id: entry.event.id,
          start: entry.start,
          end: entry.end,
          columnCount: 1,
          entries: [{ event: entry.event, start: entry.start, end: entry.end, column: 0, columnSpan: 1 }],
        });
        return;
      }

      lastGroup.end = Math.max(lastGroup.end, entry.end);
      lastGroup.id = `${lastGroup.id}-${entry.event.id}`;
      lastGroup.entries.push({ event: entry.event, start: entry.start, end: entry.end, column: 0, columnSpan: 1 });
    });

    const normalizedSingleDayGroups = singleDayGroups.map((group) => {
      const columnEnds: number[] = [];
      const singleDayEntries = group.entries.map((entry) => {
        const column = columnEnds.findIndex((columnEnd) => entry.start >= columnEnd);
        const nextColumn = column === -1 ? columnEnds.length : column;
        columnEnds[nextColumn] = entry.end;

        return {
          ...entry,
          column: multiDayEvents.length + nextColumn,
        };
      });

      return {
        ...group,
        columnCount: multiDayEvents.length + Math.max(1, columnEnds.length),
        entries: singleDayEntries,
      };
    });

    const maxColumnCount = Math.max(...normalizedSingleDayGroups.map((group) => group.columnCount));

    return normalizedSingleDayGroups.map((group) => ({
      ...group,
      columnCount: maxColumnCount,
      entries: expandScheduleEntryColumns(group.entries, maxColumnCount),
    }));
  }

  sortedEvents.forEach((event) => {
    const visualDuration = isMultiDayEvent(event) ? visualDurationForMultiDayEvent(sortedEvents, dateKey, event.id) : scheduleDefaultVisualDuration;
    const { start, end } = eventTimelineSegment(event, dateKey, visualDuration);
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || start >= lastGroup.end) {
      groups.push({
        id: event.id,
        start,
        end,
        columnCount: 1,
        entries: [{ event, start, end, column: 0, columnSpan: 1 }],
      });
      return;
    }

    lastGroup.end = Math.max(lastGroup.end, end);
    lastGroup.id = `${lastGroup.id}-${event.id}`;
    lastGroup.entries.push({ event, start, end, column: 0, columnSpan: 1 });
  });

  return groups.map((group) => {
    const columnEnds: number[] = [];
    const entries = group.entries.map((entry) => {
      const column = columnEnds.findIndex((columnEnd) => entry.start >= columnEnd);
      const nextColumn = column === -1 ? columnEnds.length : column;
      columnEnds[nextColumn] = entry.end;

      return {
        ...entry,
        column: nextColumn,
      };
    });

    return {
      ...group,
      columnCount: Math.max(1, columnEnds.length),
      entries: expandScheduleEntryColumns(entries, Math.max(1, columnEnds.length)),
    };
  });
};

const normalizeNotifications = (values?: NotificationOption[]) => {
  if (!values || values.length === 0 || values.includes('none')) {
    return ['none'] as NotificationOption[];
  }

  return values;
};

const notificationLabel = (value: NotificationOption, atTimeLabel = '開始時刻') => {
  if (value === 'atStart') {
    return atTimeLabel;
  }

  return notificationOptions.find((option) => option.value === value)?.label ?? value;
};

const formatNotificationSummary = (values: NotificationOption[], atTimeLabel = '開始時刻') =>
  normalizeNotifications(values).map((value) => notificationLabel(value, atTimeLabel)).join(', ');

const notificationsFromLegacy = (notification?: string) => {
  const matched = notificationOptions.find((option) => option.label === notification);
  return matched && matched.value !== 'none' ? [matched.value] : (['none'] as NotificationOption[]);
};

const notificationIdentifier = (eventId: string, option: Exclude<NotificationOption, 'none'>) =>
  `${notificationIdentifierPrefix}${eventId}-${option}`;

const activeNotificationOptions = (event: CalendarEvent) =>
  normalizeNotifications(event.startNotifications ?? notificationsFromLegacy(event.notification)).filter(
    (option): option is Exclude<NotificationOption, 'none'> => option !== 'none',
  );

const eventStartDateTime = (event: CalendarEvent) => {
  const date = parseDateKey(event.date);
  const start = minutesFromTime(event.start);
  date.setHours(Math.floor(start / 60), start % 60, 0, 0);
  return date;
};

const eventEndDateTime = (event: CalendarEvent) => {
  const date = parseDateKey(eventEndDate(event));
  const end = minutesFromTime(event.end);
  date.setHours(Math.floor(end / 60), end % 60, 0, 0);
  return date;
};

const notificationTriggerDate = (event: CalendarEvent, option: Exclude<NotificationOption, 'none'>) =>
  new Date(eventStartDateTime(event).getTime() - notificationOffsets[option] * 60 * 1000);

const promptNotificationSettings = () => {
  Alert.alert('通知を許可してください', 'iPhoneの設定でYohaku Calendarの通知をオンにしてください。', [
    { text: 'キャンセル', style: 'cancel' },
    {
      text: '設定を開く',
      onPress: () => {
        Linking.openSettings().catch(() => {
          Alert.alert('設定を開けませんでした');
        });
      },
    },
  ]);
};

const ensureNotificationPermission = async (showSettingsPrompt = false) => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  if (!requested.granted && showSettingsPrompt) {
    promptNotificationSettings();
  }

  return requested.granted;
};

const cancelYohakuScheduledNotifications = async () => {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduledNotifications
      .filter((request) => request.identifier.startsWith(notificationIdentifierPrefix))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
};

const syncEventNotifications = async (events: CalendarEvent[], settings: NotificationSettings) => {
  await cancelYohakuScheduledNotifications();

  if (!settings.eventNotificationsEnabled) {
    return;
  }

  const now = Date.now();
  const schedulableEvents = events
    .flatMap((event) => activeNotificationOptions(event).map((option) => ({ event, option, triggerDate: notificationTriggerDate(event, option) })))
    .filter(({ triggerDate }) => triggerDate.getTime() > now + 1000);
  if (schedulableEvents.length === 0) {
    return;
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    return;
  }

  await Promise.all(
    schedulableEvents.map(({ event, option, triggerDate }) =>
      Notifications.scheduleNotificationAsync({
        identifier: notificationIdentifier(event.id, option),
        content: {
          title: event.title,
          body: `${formatFullDate(event.date)} ${event.start}`,
          sound: settings.soundEnabled ? 'default' : false,
          data: {
            eventId: event.id,
            notificationOption: option,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      }),
    ),
  );
};

const scheduleTestNotification = async (settings: NotificationSettings) => {
  if (!settings.eventNotificationsEnabled) {
    Alert.alert('通知を受け取る設定がオフです');
    return false;
  }

  const granted = await ensureNotificationPermission(true);
  if (!granted) {
    return false;
  }

  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduledNotifications
      .filter((request) => request.identifier.startsWith(testNotificationIdentifierPrefix))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  await Notifications.scheduleNotificationAsync({
    identifier: `${testNotificationIdentifierPrefix}${Date.now()}`,
    content: {
      title: 'Yohaku Calendar',
      body: 'テスト通知です',
      sound: settings.soundEnabled ? 'default' : false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });

  return true;
};

const nearestMinuteStep = (minute: number) => Math.min(50, Math.max(0, Math.round(minute / 10) * 10));

const emptyDraft = (date: string): EventDraft => ({
  title: '',
  date,
  endDate: date,
  start: '10:00',
  end: '11:00',
  startNotifications: ['none'],
  endNotifications: ['none'],
});

const countEventsOnDate = (events: CalendarEvent[], dateKey: string) => events.filter((event) => eventOccursOnDate(event, dateKey)).length;

const dateOpacityForEventCount = (eventCount: number) => {
  if (eventCount === 0) {
    return 0.1;
  }

  if (eventCount === 1) {
    return 0.5;
  }

  return 1;
};

const draftFromEvent = (event: CalendarEvent): EventDraft => ({
  title: event.title,
  date: event.date,
  endDate: eventEndDate(event),
  start: event.start,
  end: event.end,
  startNotifications: normalizeNotifications(event.startNotifications ?? notificationsFromLegacy(event.notification)),
  endNotifications: normalizeNotifications(event.endNotifications),
});

const normalizeBackupEvent = (value: unknown): CalendarEvent | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as Partial<CalendarEvent>;
  if (
    typeof event.id !== 'string' ||
    typeof event.title !== 'string' ||
    typeof event.date !== 'string' ||
    typeof event.start !== 'string' ||
    typeof event.end !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
    (typeof event.endDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate)) ||
    !isTime(event.start) ||
    !isTime(event.end)
  ) {
    return null;
  }

  return {
    id: event.id,
    title: event.title,
    date: event.date,
    endDate: event.endDate,
    start: event.start,
    end: event.end,
    startNotifications: normalizeNotifications(event.startNotifications ?? notificationsFromLegacy(event.notification)),
  };
};

const normalizeBackupNotificationSettings = (value: unknown): NotificationSettings => {
  if (!value || typeof value !== 'object') {
    return defaultNotificationSettings;
  }

  const settings = value as Partial<NotificationSettings>;
  return {
    eventNotificationsEnabled:
      typeof settings.eventNotificationsEnabled === 'boolean' ? settings.eventNotificationsEnabled : defaultNotificationSettings.eventNotificationsEnabled,
    soundEnabled: typeof settings.soundEnabled === 'boolean' ? settings.soundEnabled : defaultNotificationSettings.soundEnabled,
  };
};

const parseBackupPayload = (rawBackup: string): BackupPayload | null => {
  try {
    const parsed = JSON.parse(rawBackup) as Partial<BackupPayload>;
    if (parsed.version !== 1 || !Array.isArray(parsed.events) || typeof parsed.exportedAt !== 'string') {
      return null;
    }

    return {
      version: 1,
      exportedAt: parsed.exportedAt,
      events: parsed.events.map(normalizeBackupEvent).filter((event): event is CalendarEvent => event !== null),
      notificationSettings: normalizeBackupNotificationSettings(parsed.notificationSettings),
    };
  } catch {
    return null;
  }
};

const formatBackupTimestamp = (value: string | null) => {
  if (!value) {
    return '未実施';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未実施';
  }

  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const initialTodayState = () => {
  const today = new Date();
  const todayKey = toDateKey(today);

  return {
    today,
    todayKey,
    visibleMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  };
};

const createMonthDays = (visibleMonth: Date, selectedDate: string, events: CalendarEvent[]): CalendarDay[] => {
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const lastDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const start = addDays(firstDay, -firstDay.getDay());
  const end = addDays(lastDay, 6 - lastDay.getDay());
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(start, index);
    const key = toDateKey(date);
    const eventCount = countEventsOnDate(events, key);

    return {
      key,
      date,
      label: String(date.getDate()),
      muted: date.getMonth() !== visibleMonth.getMonth(),
      eventCount,
      selected: key === selectedDate,
    };
  });
};

const buildYohakuTodayWidgetProps = (
  events: CalendarEvent[],
  date = new Date(),
  theme: ThemePalette = defaultTheme,
): YohakuTodayWidgetProps => {
  const dateKey = toDateKey(date);
  const visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayEvents = sortEventsForDate(
    events.filter((event) => eventOccursOnDate(event, dateKey)),
    dateKey,
  );
  const calendarDays = createMonthDays(visibleMonth, dateKey, events);
  const toWidgetEvent = (event: CalendarEvent) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    endDate: eventEndDate(event),
    time: event.start,
    end: event.end,
  });
  const widgetEvents = dayEvents.map(toWidgetEvent);

  return {
    dateKey,
    dateLabel: formatWidgetDateTitle(dateKey),
    monthLabel: formatWidgetMonthTitle(date),
    themeBackground: theme.background,
    themeSurface: theme.surface,
    themeBorder: theme.border,
    themeDot: theme.dot,
    calendarDays: calendarDays.map((day) => ({
      key: day.key,
      label: day.label,
      muted: day.muted,
      selected: day.selected,
      eventCount: day.eventCount,
    })),
    totalCount: dayEvents.length,
    events: widgetEvents,
    timelineEvents: dayEvents
      .filter((event) => eventEndDateTime(event).getTime() >= date.getTime())
      .map(toWidgetEvent),
  };
};

const buildYohakuTodayWidgetTimeline = (
  events: CalendarEvent[],
  theme: ThemePalette = defaultTheme,
) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const timelineEnd = addDays(todayStart, 8);
  const entryTimes = [now.getTime()];

  for (let index = 1; index < 8; index += 1) {
    entryTimes.push(addDays(todayStart, index).getTime());
  }

  events.forEach((event) => {
    const hideAt = eventEndDateTime(event).getTime() + 1000;
    if (hideAt > now.getTime() && hideAt < timelineEnd.getTime()) {
      entryTimes.push(hideAt);
    }
  });

  return Array.from(new Set(entryTimes))
    .sort((first, second) => first - second)
    .map((timestamp) => {
      const entryDate = new Date(timestamp);
      return {
        date: entryDate,
        props: buildYohakuTodayWidgetProps(events, entryDate, theme),
      };
    });
};

const syncYohakuTodayWidget = (events: CalendarEvent[], theme: ThemePalette) => {
  try {
    type YohakuWidgetApi = {
      updateSnapshot: (props: YohakuTodayWidgetProps) => void;
      updateTimeline: (entries: ReturnType<typeof buildYohakuTodayWidgetTimeline>) => void;
    };
    const YohakuWidgets = require('./widgets/YohakuTodayWidget') as {
      default: YohakuWidgetApi;
      YohakuMediumWidget: YohakuWidgetApi;
      YohakuLargeWidget: YohakuWidgetApi;
      YohakuCalendarWidget: YohakuWidgetApi;
      YohakuTimelineWidget: YohakuWidgetApi;
      YohakuLockTasksWidget: YohakuWidgetApi;
      YohakuLockCalendarWidget: YohakuWidgetApi;
    };
    const snapshot = buildYohakuTodayWidgetProps(events, new Date(), theme);
    const timeline = buildYohakuTodayWidgetTimeline(events, theme);

    [
      YohakuWidgets.default,
      YohakuWidgets.YohakuMediumWidget,
      YohakuWidgets.YohakuLargeWidget,
      YohakuWidgets.YohakuCalendarWidget,
      YohakuWidgets.YohakuTimelineWidget,
      YohakuWidgets.YohakuLockTasksWidget,
      YohakuWidgets.YohakuLockCalendarWidget,
    ].forEach((widget) => {
      widget.updateSnapshot(snapshot);
      widget.updateTimeline(timeline);
    });
  } catch {
    // Widget APIs are native-only and can be unavailable in non-native runtimes.
  }
};

export default function App() {
  const [initialCalendarState] = useState(initialTodayState);
  const [mode, setMode] = useState<ViewMode>('month');
  const [lastCalendarMode, setLastCalendarMode] = useState<CalendarMode>('month');
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [selectedDate, setSelectedDate] = useState(initialCalendarState.todayKey);
  const [visibleMonth, setVisibleMonth] = useState(initialCalendarState.visibleMonth);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState(initialEvents[0].id);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft(initialCalendarState.todayKey));
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [selectedThemeId, setSelectedThemeId] = useState(defaultTheme.id);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<TimeFieldKey | null>(null);
  const [timePickerTarget, setTimePickerTarget] = useState<TimeFieldKey | null>(null);
  const [notificationPickerVisible, setNotificationPickerVisible] = useState(false);
  const [previousCalendarState, setPreviousCalendarState] = useState<CalendarRenderState | null>(null);
  const [calendarTransitionFade] = useState(() => new Animated.Value(1));
  const autoBackupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsActionRef = useRef<(() => void) | null>(null);
  const pendingSettingsActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringBackupRef = useRef(false);
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const activeTheme = useMemo(
    () => themePalettes.find((theme) => theme.id === selectedThemeId) ?? defaultTheme,
    [selectedThemeId],
  );
  const activeTokens = useMemo(() => createAppTokens(activeTheme), [activeTheme]);
  const activeStyles = useMemo(() => createStyles(activeTokens), [activeTokens]);
  tokens = activeTokens;
  styles = activeStyles;

  useEffect(() => {
    const savedEvents = localStorage.getItem(eventStorageKey);
    const savedNotificationSettings = localStorage.getItem(notificationSettingsStorageKey);
    const notificationPermissionPrompted = localStorage.getItem(notificationPermissionPromptedStorageKey);
    const savedLastBackupAt = localStorage.getItem(backupLastBackupAtStorageKey);
    const savedThemeId = localStorage.getItem(themeStorageKey);

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

    if (savedNotificationSettings) {
      try {
        setNotificationSettings({
          ...defaultNotificationSettings,
          ...(JSON.parse(savedNotificationSettings) as Partial<NotificationSettings>),
        });
      } catch {
        localStorage.removeItem(notificationSettingsStorageKey);
      }
    }

    setAutoBackupEnabled(false);
    setLastBackupAt(savedLastBackupAt || null);
    if (savedThemeId && themePalettes.some((theme) => theme.id === savedThemeId)) {
      setSelectedThemeId(savedThemeId);
    }
    setStorageReady(true);

    if (!savedNotificationSettings && notificationPermissionPrompted !== 'true') {
      localStorage.setItem(notificationPermissionPromptedStorageKey, 'true');
      ensureNotificationPermission().then((granted) => {
        if (!granted) {
          setNotificationSettings((current) => ({ ...current, eventNotificationsEnabled: false }));
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    localStorage.setItem(eventStorageKey, JSON.stringify(events));
  }, [events, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    syncYohakuTodayWidget(events, activeTheme);
  }, [activeTheme, events, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    localStorage.setItem(notificationSettingsStorageKey, JSON.stringify(notificationSettings));
  }, [notificationSettings, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    localStorage.setItem(themeStorageKey, selectedThemeId);
  }, [selectedThemeId, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    localStorage.setItem(backupAutoEnabledStorageKey, String(autoBackupEnabled));
  }, [autoBackupEnabled, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    if (lastBackupAt) {
      localStorage.setItem(backupLastBackupAtStorageKey, lastBackupAt);
      return;
    }

    localStorage.removeItem(backupLastBackupAtStorageKey);
  }, [lastBackupAt, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    syncEventNotifications(events, notificationSettings).catch(() => {
      // 通知権限がない環境や未対応環境では、予定保存自体は妨げない。
    });
  }, [events, notificationSettings, storageReady]);

  useEffect(() => {
    if (!previousCalendarState) {
      return;
    }

    Animated.timing(calendarTransitionFade, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPreviousCalendarState(null);
      }
    });
  }, [calendarTransitionFade, previousCalendarState]);

  const headerTitle = useMemo(() => {
    if (mode === 'month') {
      return formatMonthTitle(visibleMonth);
    }

    if (mode === 'pro') {
      return 'Proプラン';
    }

    if (mode === 'notificationSettings') {
      return '通知設定';
    }

    if (mode === 'theme') {
      return 'テーマカラー';
    }

    if (mode === 'backup') {
      return 'バックアップ';
    }

    return '';
  }, [mode, visibleMonth]);

  const selectDate = (date: Date, nextMode: ViewMode = 'month') => {
    const key = toDateKey(date);
    setSelectedDate(key);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    if (nextMode === 'month') {
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

  const currentCalendarState: CalendarRenderState = {
    mode: 'month',
    selectedDate,
    visibleMonth,
    events,
  };

  const fadeFromCurrentCalendar = (commit: () => void) => {
    if (mode !== 'month') {
      commit();
      return;
    }

    calendarTransitionFade.stopAnimation();
    calendarTransitionFade.setValue(1);
    setPreviousCalendarState(currentCalendarState);
    commit();
  };

  const openEvent = (event: CalendarEvent) => {
    if (mode === 'month') {
      setLastCalendarMode(mode);
    }
    setSelectedDate(event.date);
    setVisibleMonth(new Date(parseDateKey(event.date).getFullYear(), parseDateKey(event.date).getMonth(), 1));
    openEditForm(event);
  };

  const openAddForm = () => {
    if (mode === 'month') {
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
    if (mode === 'form') {
      setMode(lastCalendarMode);
      return;
    }

    if (mode === 'pro' || mode === 'notificationSettings' || mode === 'theme' || mode === 'backup') {
      setMode('month');
      return;
    }

    setMode('month');
  };

  const saveEvent = () => {
    const title = draft.title.trim();
    const date = draft.date.trim();
    const endDate = draft.endDate.trim();
    const start = draft.start.trim();
    const end = draft.end.trim();

    if (!title) {
      Alert.alert('タイトルを入力してください');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      Alert.alert('日付は YYYY-MM-DD で入力してください');
      return;
    }

    if (!isTime(start) || !isTime(end)) {
      Alert.alert('時刻は HH:MM で入力してください');
      return;
    }

    if (endDate < date || (endDate === date && minutesFromTime(start) >= minutesFromTime(end))) {
      Alert.alert('終了時刻は開始時刻より後にしてください');
      return;
    }

    const savedEvent: CalendarEvent = {
      id: formMode === 'add' ? `event-${Date.now()}` : selectedEventId,
      title,
      date,
      endDate,
      start,
      end,
      startNotifications: normalizeNotifications(draft.startNotifications),
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
    setMode('month');
  };

  const confirmDeleteEvent = () => {
    if (formMode !== 'edit' || !selectedEventId) {
      return;
    }

    const eventToDelete = events.find((event) => event.id === selectedEventId);

    Alert.alert(
      '予定を削除しますか？',
      eventToDelete ? `「${eventToDelete.title}」を削除します。` : 'この予定を削除します。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            setEvents((current) => current.filter((event) => event.id !== selectedEventId));
            setSelectedEventId('');
            setMode('month');
          },
        },
      ],
    );
  };

  const jumpToday = () => {
    if (previousCalendarState) {
      return;
    }

    const today = new Date();
    fadeFromCurrentCalendar(() => selectDate(today, 'month'));
  };

  const activeCalendarMode: CalendarMode | null = mode === 'month' ? mode : null;

  const renderCalendarContent = (state: CalendarRenderState) => {
    const stateEvents = sortEventsForDate(state.events.filter((event) => eventOccursOnDate(event, state.selectedDate)), state.selectedDate);

    return (
      <MonthScreen
        compact={compact}
        viewportWidth={width}
        visibleMonth={state.visibleMonth}
        allEvents={state.events}
        events={stateEvents}
        selectedDate={state.selectedDate}
        onSelectDate={(date) => selectDate(date)}
        onSwipeMonth={moveVisibleMonth}
        onSelectEvent={openEvent}
      />
    );
  };

  const activeCalendarState: CalendarRenderState | null = activeCalendarMode
    ? {
        mode: activeCalendarMode,
        selectedDate,
        visibleMonth,
        events,
      }
    : null;

  const changeEventNotificationsEnabled = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationSettings((current) => ({ ...current, eventNotificationsEnabled: false }));
      return;
    }

    const granted = await ensureNotificationPermission(true);
    if (!granted) {
      setNotificationSettings((current) => ({ ...current, eventNotificationsEnabled: false }));
      return;
    }

    setNotificationSettings((current) => ({ ...current, eventNotificationsEnabled: true }));
  };

  const changeNotificationSoundEnabled = (enabled: boolean) => {
    setNotificationSettings((current) => ({ ...current, soundEnabled: enabled }));
  };

  const testNotification = () => {
    scheduleTestNotification(notificationSettings).catch(() => {
      Alert.alert('テスト通知を送信できませんでした');
    });
  };

  const runBackupToICloud = async (showAlert = true) => {
    if (backupBusy) {
      return false;
    }

    setBackupBusy(true);
    try {
      const available = await CloudStorage.isCloudAvailable();
      if (!available) {
        if (showAlert) {
          Alert.alert('iCloud未接続', 'iCloud Drive が利用できません。端末の iCloud 設定を確認してください。');
        }
        return false;
      }

      const payload: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        events: sortEvents(events),
        notificationSettings,
      };
      const payloadText = JSON.stringify(payload);

      await CloudStorage.mkdir(iCloudBackupDirectory).catch(() => {
        // Directory may already exist.
      });
      await CloudStorage.writeFile(iCloudBackupPath, payloadText);
      await CloudStorage.triggerSync(iCloudBackupPath).catch(() => {
        // iCloud sync is eventually consistent; best effort is enough here.
      });

      let backedUpAt = payload.exportedAt;
      try {
        const stat = await CloudStorage.stat(iCloudBackupPath);
        backedUpAt = stat.mtime.toISOString();
      } catch {
        backedUpAt = payload.exportedAt;
      }

      setLastBackupAt(backedUpAt);
      if (showAlert) {
        Alert.alert('バックアップ完了', '現在の予定を iCloud に保存しました。');
      }
      return true;
    } catch {
      if (showAlert) {
        Alert.alert('バックアップエラー', 'iCloud へのバックアップに失敗しました。');
      }
      return false;
    } finally {
      setBackupBusy(false);
    }
  };

  const changeAutoBackupEnabled = async (enabled: boolean) => {
    if (!enabled) {
      setAutoBackupEnabled(false);
      return;
    }

    Alert.alert('Pro限定機能です', '自動バックアップはProプランで利用できます。');
    setAutoBackupEnabled(false);
  };

  const restoreBackupFromICloud = async () => {
    if (backupBusy) {
      return;
    }

    const available = await CloudStorage.isCloudAvailable();
    if (!available) {
      Alert.alert('iCloud未接続', 'iCloud Drive が利用できません。端末の iCloud 設定を確認してください。');
      return;
    }

    const exists = await CloudStorage.exists(iCloudBackupPath);
    if (!exists) {
      Alert.alert('バックアップなし', 'iCloud に復元できるバックアップがまだありません。');
      return;
    }

    Alert.alert('バックアップから復元', '現在の予定を、iCloud に保存された内容で上書きします。よろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '復元する',
        style: 'destructive',
        onPress: async () => {
          setBackupBusy(true);
          restoringBackupRef.current = true;
          try {
            await CloudStorage.triggerSync(iCloudBackupPath).catch(() => {
              // Best effort only.
            });
            const rawBackup = await CloudStorage.readFile(iCloudBackupPath);
            const backup = parseBackupPayload(rawBackup);
            if (!backup) {
              Alert.alert('復元エラー', 'バックアップデータの形式を読み取れませんでした。');
              return;
            }

            const restoredEvents = sortEvents(backup.events);
            setEvents(restoredEvents);
            setNotificationSettings(backup.notificationSettings);
            setSelectedEventId(restoredEvents[0]?.id ?? '');
            const nextSelectedDate = restoredEvents[0]?.date ?? toDateKey(new Date());
            setSelectedDate(nextSelectedDate);
            setVisibleMonth(new Date(parseDateKey(nextSelectedDate).getFullYear(), parseDateKey(nextSelectedDate).getMonth(), 1));
            setMode('month');

            try {
              const stat = await CloudStorage.stat(iCloudBackupPath);
              setLastBackupAt(stat.mtime.toISOString());
            } catch {
              setLastBackupAt(backup.exportedAt);
            }

            Alert.alert('復元完了', 'iCloud バックアップから予定を復元しました。');
          } catch {
            Alert.alert('復元エラー', 'iCloud バックアップの復元に失敗しました。');
          } finally {
            restoringBackupRef.current = false;
            setBackupBusy(false);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    if (!storageReady || !autoBackupEnabled || restoringBackupRef.current) {
      return;
    }

    if (autoBackupTimerRef.current) {
      clearTimeout(autoBackupTimerRef.current);
    }

    autoBackupTimerRef.current = setTimeout(() => {
      runBackupToICloud(false).catch(() => {
        // Manual backup reports errors; automatic backup stays quiet.
      });
    }, 1500);

    return () => {
      if (autoBackupTimerRef.current) {
        clearTimeout(autoBackupTimerRef.current);
        autoBackupTimerRef.current = null;
      }
    };
  }, [autoBackupEnabled, events, notificationSettings, storageReady]);

  const runPendingSettingsAction = () => {
    const action = pendingSettingsActionRef.current;
    if (!action) {
      return;
    }

    pendingSettingsActionRef.current = null;
    if (pendingSettingsActionTimerRef.current) {
      clearTimeout(pendingSettingsActionTimerRef.current);
      pendingSettingsActionTimerRef.current = null;
    }
    requestAnimationFrame(action);
  };

  const closeSettingsThenRun = (action: () => void) => {
    pendingSettingsActionRef.current = action;
    setSettingsVisible(false);
    if (pendingSettingsActionTimerRef.current) {
      clearTimeout(pendingSettingsActionTimerRef.current);
    }
    pendingSettingsActionTimerRef.current = setTimeout(runPendingSettingsAction, 900);
  };

  const shareApp = () => {
    closeSettingsThenRun(() => {
      Share.share({
        title: 'Yohaku Calendar',
        message: 'Yohaku Calendar',
        url: appStoreShareUrl,
      }).catch(() => {
        Alert.alert('共有できませんでした');
      });
    });
  };

  const openStoreReview = () => {
    closeSettingsThenRun(() => {
      Linking.openURL(appStoreReviewUrl).catch(() => {
        Linking.openURL(appStoreReviewFallbackUrl).catch(() => {
          Alert.alert('ストアレビューを開けませんでした');
        });
      });
    });
  };

  const openTerms = () => {
    closeSettingsThenRun(() => {
      void WebBrowser.openBrowserAsync(appleStandardEulaUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      }).catch(() => {
        WebBrowser.openBrowserAsync(appleStandardEulaUrl).catch(() => {
          Linking.openURL(appleStandardEulaUrl).catch(() => {
            Alert.alert('利用規約を開けませんでした');
          });
        });
      });
    });
  };

  const resetAppData = () => {
    setSettingsVisible(false);
    Alert.alert('データ初期化', '登録済みのすべての予定と、通知設定・バックアップ設定を初期状態に戻します。よろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '初期化する',
        style: 'destructive',
        onPress: async () => {
          const today = new Date();
          const todayKey = toDateKey(today);
          localStorage.setItem(notificationPermissionPromptedStorageKey, 'true');
          const notificationGranted = await ensureNotificationPermission();
          const nextNotificationSettings: NotificationSettings = {
            ...defaultNotificationSettings,
            eventNotificationsEnabled: notificationGranted,
          };

          setEvents([]);
          setNotificationSettings(nextNotificationSettings);
          setSelectedThemeId(defaultTheme.id);
          setAutoBackupEnabled(false);
          setLastBackupAt(null);
          setSelectedEventId('');
          setSelectedDate(todayKey);
          setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
          setDraft(emptyDraft(todayKey));
          setFormMode('add');
          setMode('month');
          setMonthPickerVisible(false);
          setDatePickerTarget(null);
          setTimePickerTarget(null);
          setNotificationPickerVisible(false);
          await cancelYohakuScheduledNotifications();
          Alert.alert('初期化完了', 'データを初期状態に戻しました。');
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.page, compact && styles.pageCompact]}>
        <Header
          title={headerTitle}
          canGoBack={mode === 'form' || mode === 'pro' || mode === 'notificationSettings' || mode === 'theme' || mode === 'backup'}
          canPickMonth={mode === 'month'}
          showCalendarActions={mode === 'month'}
          showSaveAction={mode === 'form'}
          showDeleteAction={mode === 'form' && formMode === 'edit'}
          onBack={back}
          onOpenMenu={() => setSettingsVisible(true)}
          onOpenMonthPicker={() => setMonthPickerVisible(true)}
          onToday={jumpToday}
          onSave={saveEvent}
          onDelete={confirmDeleteEvent}
        />

        {activeCalendarState && (
          <View style={styles.calendarLayer}>
            <View style={styles.calendarStack}>
              <Animated.View
                pointerEvents={mode === 'month' && !previousCalendarState ? 'auto' : 'none'}
                style={styles.calendarFadeLayer}
              >
                {renderCalendarContent({ ...activeCalendarState, mode: 'month' })}
              </Animated.View>
              {previousCalendarState ? (
                <Animated.View pointerEvents="none" style={[styles.calendarFadeLayer, { opacity: calendarTransitionFade }]}>
                  {renderCalendarContent(previousCalendarState)}
                </Animated.View>
              ) : null}
            </View>
          </View>
        )}

        {mode === 'form' && (
          <EventForm
            draft={draft}
            onChange={setDraft}
            onOpenDatePicker={(key) => setDatePickerTarget(key ?? 'start')}
            onOpenTimePicker={setTimePickerTarget}
            onOpenNotificationPicker={() => setNotificationPickerVisible(true)}
          />
        )}

        {mode === 'pro' && <ProPlanScreen />}

        {mode === 'notificationSettings' && (
          <NotificationSettingsScreen
            eventNotificationsEnabled={notificationSettings.eventNotificationsEnabled}
            soundEnabled={notificationSettings.soundEnabled}
            onEventNotificationsChange={changeEventNotificationsEnabled}
            onSoundChange={changeNotificationSoundEnabled}
            onTestNotification={testNotification}
          />
        )}

        {mode === 'theme' && (
          <ThemeColorScreen selectedThemeId={selectedThemeId} onSelectTheme={setSelectedThemeId} />
        )}

        {mode === 'backup' && (
          <BackupScreen
            autoBackupEnabled={autoBackupEnabled}
            lastBackupAt={lastBackupAt}
            busy={backupBusy}
            onAutoBackupChange={changeAutoBackupEnabled}
            onRunBackup={() => {
              void runBackupToICloud();
            }}
            onRestoreBackup={() => {
              void restoreBackupFromICloud();
            }}
          />
        )}

        {mode === 'month' && (
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

        <SettingsSheet
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onDismiss={runPendingSettingsAction}
          onOpenPro={() => {
            setSettingsVisible(false);
            setMode('pro');
          }}
          onOpenNotificationSettings={() => {
            setSettingsVisible(false);
            setMode('notificationSettings');
          }}
          onOpenTheme={() => {
            setSettingsVisible(false);
            setMode('theme');
          }}
          onOpenBackup={() => {
            setSettingsVisible(false);
            setMode('backup');
          }}
          onShareApp={shareApp}
          onOpenStoreReview={openStoreReview}
          onOpenTerms={openTerms}
          onResetData={resetAppData}
        />

        <DatePicker
          visible={datePickerTarget !== null}
          value={parseValidDateKey(datePickerTarget === 'end' ? draft.endDate : draft.date, parseDateKey(selectedDate))}
          onClose={() => setDatePickerTarget(null)}
          onSelect={(date) => {
            const dateKey = toDateKey(date);
            setDraft((current) =>
              datePickerTarget === 'end'
                ? { ...current, endDate: dateKey }
                : { ...current, date: dateKey, endDate: current.endDate < dateKey ? dateKey : current.endDate },
            );
            setDatePickerTarget(null);
          }}
        />

        <TimePicker
          visible={timePickerTarget !== null}
          value={timePickerTarget ? draft[timePickerTarget] : '10:00'}
          onClose={() => setTimePickerTarget(null)}
          onSelect={(time) => {
            if (timePickerTarget) {
              setDraft((current) => ({ ...current, [timePickerTarget]: time }));
            }
            setTimePickerTarget(null);
          }}
        />

        <NotificationPicker
          visible={notificationPickerVisible}
          atTimeLabel="開始時刻"
          values={draft.startNotifications}
          onClose={() => setNotificationPickerVisible(false)}
          onSelect={(values) => {
            setDraft((current) => ({ ...current, startNotifications: values }));
            setNotificationPickerVisible(false);
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
  showSaveAction,
  showDeleteAction,
  onBack,
  onOpenMenu,
  onOpenMonthPicker,
  onToday,
  onSave,
  onDelete,
}: {
  title: string;
  canGoBack: boolean;
  canPickMonth: boolean;
  showCalendarActions: boolean;
  showSaveAction: boolean;
  showDeleteAction: boolean;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenMonthPicker: () => void;
  onToday: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.header}>
      {canGoBack ? (
        <Pressable onPress={onBack} hitSlop={18} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.headerAction}>‹</Text>
        </Pressable>
      ) : showCalendarActions || canPickMonth ? (
        <Pressable onPress={onOpenMenu} hitSlop={14} style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}>
          <GearIcon />
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
      )}

      {(showCalendarActions || canPickMonth) && !canGoBack ? (
        <Pressable onPress={onOpenMonthPicker} hitSlop={12} style={({ pressed }) => [styles.centerMonthTitleButton, pressed && styles.pressed]}>
          <Text style={styles.headerTitle}>{title}</Text>
          <DownChevron />
        </Pressable>
      ) : null}

      {!showCalendarActions && !canPickMonth ? <Text style={styles.headerTitle}>{title}</Text> : null}

      {showCalendarActions ? (
        <View style={styles.headerActions}>
          <Pressable onPress={onToday} hitSlop={14} style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}>
            <TodayIcon />
          </Pressable>
        </View>
      ) : showSaveAction ? (
        <View style={[styles.headerActions, showDeleteAction && styles.headerActionsWide]}>
          {showDeleteAction ? (
            <Pressable onPress={onDelete} hitSlop={14} style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}>
              <CloseIcon />
            </Pressable>
          ) : null}
          <Pressable onPress={onSave} hitSlop={14} style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}>
            <CheckIcon />
          </Pressable>
        </View>
      ) : (
        <View style={styles.headerSide} />
      )}
    </View>
  );
}

function TodayIcon() {
  return <MaterialIcons name="refresh" size={22} color={tokens.text} />;
}

function GearIcon() {
  return <MaterialIcons name="menu" size={22} color={tokens.text} />;
}

function DownChevron() {
  return (
    <View style={styles.downChevronIcon}>
      <View style={styles.downChevronLineLeft} />
      <View style={styles.downChevronLineRight} />
    </View>
  );
}

function CloseIcon() {
  return <Text style={styles.closeIconText}>×</Text>;
}

function CheckIcon() {
  return <Text style={styles.checkIconText}>✓</Text>;
}

function AnimatedSelectedCircle({
  selected,
  style,
  children,
}: {
  selected: boolean;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [selectedOpacity] = useState(() => new Animated.Value(selected ? 1 : 0));

  useEffect(() => {
    Animated.timing(selectedOpacity, {
      toValue: selected ? 1 : 0,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [selected, selectedOpacity]);

  return (
    <View style={style}>
      <Animated.View pointerEvents="none" style={[styles.selectedDateCircleFill, { opacity: selectedOpacity }]} />
      {children}
    </View>
  );
}

function FadeOnChange({ watchKey, style, children }: { watchKey: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const previousWatchKey = useRef(watchKey);

  useEffect(() => {
    if (previousWatchKey.current === watchKey) {
      return;
    }

    previousWatchKey.current = watchKey;
    opacity.stopAnimation();
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [opacity, watchKey]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
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
    () =>
      pageOffsets.map((offset) => ({
        offset,
        days: Math.abs(offset - pageIndex) <= 1 ? createMonthDays(addMonths(anchorMonth, offset), selectedDate, allEvents) : null,
      })),
    [allEvents, anchorMonth, pageIndex, pageOffsets, selectedDate],
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
          {monthPages.map((page) => (
            <View key={page.offset} style={{ width: viewportWidth }}>
              {page.days ? (
                <>
                  <View style={styles.weekRow}>
                    {weekdays.map((weekday) => (
                      <Text key={weekday} style={styles.weekday}>
                        {weekday}
                      </Text>
                    ))}
                  </View>

                  <View style={[styles.calendarGrid, compact && styles.calendarGridCompact]}>
                    {page.days.map((day) => (
                      <Pressable
                        key={day.key}
                        disabled={day.muted}
                        onPress={() => onSelectDate(day.date)}
                        onLongPress={() => onSelectDate(day.date)}
                        style={styles.dateCell}
                      >
                        {day.muted ? null : (
                          <>
                            <AnimatedSelectedCircle selected={day.selected} style={styles.dateCircle}>
                              <Text style={[styles.dateText, { opacity: dateOpacityForEventCount(day.eventCount) }]}>{day.label}</Text>
                            </AnimatedSelectedCircle>
                          </>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ))}
        </Animated.View>
      </View>

      <ScrollView style={styles.scheduleScroll} contentContainerStyle={styles.scheduleList} showsVerticalScrollIndicator={false}>
        <FadeOnChange watchKey={selectedDate}>
          <Text style={styles.selectedDateText}>{formatShortDateTitle(selectedDate)}</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>予定はありません</Text>
        ) : (
          <ScheduleTimeline events={events} selectedDate={selectedDate} onSelectEvent={onSelectEvent} />
          )}
        </FadeOnChange>
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
  const yearScrollRef = useRef<ScrollView | null>(null);
  const monthScrollRef = useRef<ScrollView | null>(null);
  const yearScrollY = useRef(new Animated.Value(0)).current;
  const monthScrollY = useRef(new Animated.Value(0)).current;
  const firstYear = value.getFullYear() - 50;
  const years = useMemo(() => Array.from({ length: 101 }, (_, index) => firstYear + index), [firstYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index), []);
  const clampIndex = (index: number, length: number) => Math.max(0, Math.min(length - 1, index));
  const scrollToSelected = (animated: boolean) => {
    const yearOffset = (value.getFullYear() - firstYear) * pickerItemHeight;
    const monthOffset = value.getMonth() * pickerItemHeight;
    yearScrollY.setValue(yearOffset);
    monthScrollY.setValue(monthOffset);
    yearScrollRef.current?.scrollTo({ y: yearOffset, animated });
    monthScrollRef.current?.scrollTo({ y: monthOffset, animated });
  };
  const updateYearFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / pickerItemHeight), years.length);
    setYear(years[index]);
  };
  const updateMonthFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / pickerItemHeight), months.length);
    setMonth(months[index]);
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    setYear(value.getFullYear());
    setMonth(value.getMonth());
    requestAnimationFrame(() => scrollToSelected(false));
  }, [firstYear, value, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <Pressable style={styles.pickerBackdropPress} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CloseIcon />
            </Pressable>
            <Text style={styles.pickerTitle}>年月</Text>
            <Pressable onPress={() => onSelect(new Date(year, month, 1))} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CheckIcon />
            </Pressable>
          </View>

          <View style={styles.pickerColumns}>
            <Animated.ScrollView
              ref={yearScrollRef}
              style={styles.pickerColumn}
              contentContainerStyle={styles.pickerColumnContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerItemHeight}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: yearScrollY } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={updateYearFromScroll}
              onScrollEndDrag={updateYearFromScroll}
              onLayout={() => visible && requestAnimationFrame(() => scrollToSelected(false))}
            >
              {years.map((item, index) => (
                <View key={item} style={styles.pickerItem}>
                  <PickerItemText scrollY={yearScrollY} index={index}>
                    {item}年
                  </PickerItemText>
                </View>
              ))}
            </Animated.ScrollView>

            <Animated.ScrollView
              ref={monthScrollRef}
              style={styles.pickerColumn}
              contentContainerStyle={styles.pickerColumnContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerItemHeight}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: monthScrollY } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={updateMonthFromScroll}
              onScrollEndDrag={updateMonthFromScroll}
              onLayout={() => visible && requestAnimationFrame(() => scrollToSelected(false))}
            >
              {months.map((item, index) => (
                <View key={item} style={styles.pickerItem}>
                  <PickerItemText scrollY={monthScrollY} index={index}>
                    {item + 1}月
                  </PickerItemText>
                </View>
              ))}
            </Animated.ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const settingsSections = [
  [
    {
      title: 'Proプラン',
    },
    {
      title: '通知設定',
    },
    {
      title: 'テーマカラー',
    },
    {
      title: 'バックアップ',
    },
  ],
  [
    {
      title: 'アプリのシェア',
    },
    {
      title: 'ストアレビュー',
    },
  ],
  [
    {
      title: '利用規約',
    },
    {
      title: 'プライバシーポリシー',
    },
    {
      title: '特定商法に基づく表記',
    },
  ],
  [
    {
      title: 'データ初期化',
    },
  ],
];

function SettingsSheet({
  visible,
  onClose,
  onDismiss,
  onOpenPro,
  onOpenNotificationSettings,
  onOpenTheme,
  onOpenBackup,
  onShareApp,
  onOpenStoreReview,
  onOpenTerms,
  onResetData,
}: {
  visible: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onOpenPro: () => void;
  onOpenNotificationSettings: () => void;
  onOpenTheme: () => void;
  onOpenBackup: () => void;
  onShareApp: () => void;
  onOpenStoreReview: () => void;
  onOpenTerms: () => void;
  onResetData: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.settingsBackdrop}>
        <Pressable style={styles.settingsBackdropPress} onPress={onClose} />
        <View style={styles.settingsSheet}>
          <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [styles.settingsCloseButton, pressed && styles.pressed]}>
            <CloseIcon />
          </Pressable>
          <View style={styles.settingsHandle} />
          <Text style={styles.settingsTitle}>設定</Text>
          <ScrollView contentContainerStyle={styles.settingsContent} showsVerticalScrollIndicator={false}>
            {settingsSections.map((section, sectionIndex) => (
              <View key={sectionIndex} style={styles.settingsSection}>
                {section.map((item, itemIndex) => (
                  <SettingsRow
                    key={item.title}
                    title={item.title}
                    onPress={
                      sectionIndex === 0 && itemIndex === 0
                        ? onOpenPro
                        : sectionIndex === 0 && itemIndex === 1
                          ? onOpenNotificationSettings
                          : sectionIndex === 0 && itemIndex === 2
                            ? onOpenTheme
                            : sectionIndex === 0 && itemIndex === 3
                              ? onOpenBackup
                              : sectionIndex === 1 && itemIndex === 0
                              ? onShareApp
                            : sectionIndex === 1 && itemIndex === 1
                              ? onOpenStoreReview
                              : sectionIndex === 2 && itemIndex === 0
                                ? onOpenTerms
                                : sectionIndex === 3 && itemIndex === 0
                                  ? onResetData
                                  : undefined
                    }
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SettingsRow({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
      <View style={styles.settingsRowText}>
        <Text style={styles.settingsRowTitle}>{title}</Text>
      </View>
      <Text style={styles.settingsChevron}>›</Text>
    </Pressable>
  );
}

function ThemeColorScreen({
  selectedThemeId,
  onSelectTheme,
}: {
  selectedThemeId: string;
  onSelectTheme: (themeId: string) => void;
}) {
  const previewDates = ['22', '23', '24', '25', '26', '27', '28'];

  return (
    <ScrollView style={styles.themeScreen} contentContainerStyle={styles.themeContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.themeIntro}>色合いを選択してください。</Text>
      <View style={styles.themeGrid}>
        {themePalettes.map((theme) => {
          const selected = theme.id === selectedThemeId;

          return (
            <Pressable
              key={theme.id}
              onPress={() => onSelectTheme(theme.id)}
              style={({ pressed }) => [
                styles.themeOption,
                { backgroundColor: theme.background, borderColor: selected ? '#777773' : theme.border },
                pressed && styles.pressed,
              ]}
            >
              {selected ? (
                <View style={styles.themeSelectedBadge}>
                  <Text style={styles.themeSelectedCheck}>✓</Text>
                </View>
              ) : null}

              <View style={[styles.themePreview, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.themePreviewHeader}>
                  <MaterialIcons name="menu" size={11} color={tokens.text} />
                  <Text style={styles.themePreviewMonth}>2026.6⌄</Text>
                  <MaterialIcons name="refresh" size={11} color={tokens.text} />
                </View>

                <View style={styles.themePreviewWeekdays}>
                  {weekdays.map((weekday) => (
                    <Text key={weekday} style={styles.themePreviewWeekday}>{weekday}</Text>
                  ))}
                </View>

                <View style={styles.themePreviewDates}>
                  {previewDates.map((date) => (
                    <View key={date} style={styles.themePreviewDateCell}>
                      {date === '27' ? <View style={[styles.themePreviewSelectedDate, { backgroundColor: theme.dot }]} /> : null}
                      <Text style={styles.themePreviewDate}>{date}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.themePreviewTimeline}>
                  <View style={styles.themePreviewTimelineRow}>
                    <Text style={styles.themePreviewTime}>19:00</Text>
                    <View style={styles.themePreviewRail}>
                      <View style={[styles.themePreviewDot, { backgroundColor: theme.dot }]} />
                      <View style={[styles.themePreviewLine, { backgroundColor: theme.border }]} />
                    </View>
                    <View style={styles.themePreviewCardsRow}>
                      <View style={[styles.themePreviewCard, { backgroundColor: theme.surface }]}>
                        <Text style={styles.themePreviewCardTitle}>テスト1</Text>
                        <Text style={styles.themePreviewCardTime}>~20:00</Text>
                      </View>
                      <View style={[styles.themePreviewCard, { backgroundColor: theme.surface }]}>
                        <Text style={styles.themePreviewCardTitle}>テスト2</Text>
                        <Text style={styles.themePreviewCardTime}>~20:00</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.themePreviewTimelineRow}>
                    <Text style={styles.themePreviewTime}>20:00</Text>
                    <View style={styles.themePreviewRail}>
                      <View style={[styles.themePreviewDot, { backgroundColor: theme.dot }]} />
                    </View>
                    <View style={[styles.themePreviewCardWide, { backgroundColor: theme.surface }]}>
                      <Text style={styles.themePreviewCardTitle}>テスト3</Text>
                      <Text style={styles.themePreviewCardTime}>~21:00</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={styles.themeOptionName}>{theme.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const proFeatures = [
  {
    title: '広告なし',
  },
  {
    title: 'iCloudの自動バックアップ',
  },
];

function ProPlanScreen() {
  return (
    <ScrollView style={styles.proScreen} contentContainerStyle={styles.proContent} showsVerticalScrollIndicator={false}>
      <View style={styles.proHero}>
        <Text style={styles.proHeroTitle}>Yohaku Pro</Text>
      </View>

      <View style={styles.proFeatureList}>
        {proFeatures.map((feature) => (
          <Pressable key={feature.title} style={({ pressed }) => [styles.proFeatureRow, pressed && styles.pressed]}>
            <View style={styles.proFeatureText}>
              <Text style={styles.proFeatureTitle}>{feature.title}</Text>
            </View>
            <Text style={styles.proChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.proPlanSection}>
        <Text style={styles.proSectionLabel}>料金プラン</Text>
        <View style={styles.proPlanCard}>
          <Pressable style={({ pressed }) => [styles.proPlanRow, pressed && styles.pressed]}>
            <Text style={styles.proPlanName}>月額</Text>
            <View style={styles.proPlanValue}>
              <Text style={styles.proPlanPrice}>300円 / 月</Text>
              <Text style={styles.proPlanCheck}>✓</Text>
            </View>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.proPlanRow, pressed && styles.pressed]}>
            <Text style={styles.proPlanName}>年額</Text>
            <Text style={styles.proPlanPrice}>2,400円 / 年</Text>
          </Pressable>
        </View>
        <Text style={styles.proCancelText}>いつでも解約できます。</Text>
      </View>

      <View style={styles.proActions}>
        <Pressable style={({ pressed }) => [styles.proStartButton, pressed && styles.pressed]}>
          <Text style={styles.proStartButtonText}>Proをはじめる</Text>
        </Pressable>
        <Pressable style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.proRestoreText}>購入を復元</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function NotificationSettingsScreen({
  eventNotificationsEnabled,
  soundEnabled,
  onEventNotificationsChange,
  onSoundChange,
  onTestNotification,
}: {
  eventNotificationsEnabled: boolean;
  soundEnabled: boolean;
  onEventNotificationsChange: (value: boolean) => void;
  onSoundChange: (value: boolean) => void;
  onTestNotification: () => void;
}) {
  return (
    <ScrollView style={styles.notificationSettingsScreen} contentContainerStyle={styles.notificationSettingsContent} showsVerticalScrollIndicator={false}>
      <View style={styles.notificationSettingsGroup}>
        <NotificationToggleRow
          title="予定の通知"
          value={eventNotificationsEnabled}
          onValueChange={onEventNotificationsChange}
        />
      </View>

      <View style={styles.notificationSettingsGroup}>
        <NotificationToggleRow
          title="通知音"
          value={soundEnabled}
          onValueChange={onSoundChange}
        />
      </View>

      <View style={styles.notificationSettingsGroup}>
        <NotificationSettingRow title="通知をテスト" onPress={onTestNotification} />
      </View>
    </ScrollView>
  );
}

function NotificationToggleRow({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.notificationSettingsRow}>
      <Text style={styles.notificationSettingsTitle}>{title === '予定の通知' ? '通知を受け取る' : title}</Text>
      <View style={styles.notificationSwitchFrame}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: switchColors.trackOff, true: switchColors.trackOn }}
          thumbColor={value ? switchColors.thumbOn : switchColors.thumbOff}
          ios_backgroundColor={switchColors.trackOff}
        />
      </View>
    </View>
  );
}

function NotificationSettingRow({ title, value, onPress }: { title: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.notificationSettingsRow, pressed && styles.pressed]}>
      <Text style={styles.notificationSettingsTitle}>{title}</Text>
      <View style={styles.notificationSettingsValueGroup}>
        {value ? <Text style={styles.notificationSettingsValue}>{value}</Text> : null}
        <Text style={styles.notificationSettingsChevron}>›</Text>
      </View>
    </Pressable>
  );
}

function BackupScreen({
  autoBackupEnabled,
  lastBackupAt,
  busy,
  onAutoBackupChange,
  onRunBackup,
  onRestoreBackup,
}: {
  autoBackupEnabled: boolean;
  lastBackupAt: string | null;
  busy: boolean;
  onAutoBackupChange: (value: boolean) => void;
  onRunBackup: () => void;
  onRestoreBackup: () => void;
}) {
  return (
    <ScrollView style={styles.backupScreen} contentContainerStyle={styles.backupContent} showsVerticalScrollIndicator={false}>
      <View style={styles.backupList}>
        <BackupToggleRow title="自動バックアップ" value={autoBackupEnabled} onValueChange={onAutoBackupChange} disabled={busy} />
        <BackupActionRow title="今すぐバックアップ" onPress={onRunBackup} disabled={busy} />
        <BackupActionRow title="バックアップから復元" onPress={onRestoreBackup} disabled={busy} />
        <Text style={styles.backupDescriptionText}>最終バックアップ {formatBackupTimestamp(lastBackupAt)}</Text>
      </View>

      <View style={styles.backupDescription}>
        <Text style={styles.backupDescriptionText}>このアプリの予定を iCloud に保存します</Text>
        <Text style={styles.backupDescriptionText}>同じApple IDの端末で復元できます</Text>
      </View>
    </ScrollView>
  );
}

function BackupToggleRow({
  title,
  value,
  onValueChange,
  disabled = false,
}: {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.backupRow}>
      <Text style={styles.backupRowTitle}>{title}</Text>
      <View style={styles.backupSwitchFrame}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: switchColors.trackOff, true: switchColors.trackOn }}
          thumbColor={value ? switchColors.thumbOn : switchColors.thumbOff}
          ios_backgroundColor={switchColors.trackOff}
        />
      </View>
    </View>
  );
}

function BackupActionRow({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.backupRow, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.backupRowTitle}>{title}</Text>
      <Text style={styles.backupChevron}>›</Text>
    </Pressable>
  );
}

function DatePicker({
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
  const [day, setDay] = useState(value.getDate());
  const yearScrollRef = useRef<ScrollView | null>(null);
  const monthScrollRef = useRef<ScrollView | null>(null);
  const dayScrollRef = useRef<ScrollView | null>(null);
  const yearScrollY = useRef(new Animated.Value(0)).current;
  const monthScrollY = useRef(new Animated.Value(0)).current;
  const dayScrollY = useRef(new Animated.Value(0)).current;
  const firstYear = value.getFullYear() - 50;
  const years = useMemo(() => Array.from({ length: 101 }, (_, index) => firstYear + index), [firstYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index), []);
  const days = useMemo(() => Array.from({ length: daysInMonth(new Date(year, month, 1)) }, (_, index) => index + 1), [month, year]);
  const clampIndex = (index: number, length: number) => Math.max(0, Math.min(length - 1, index));
  const scrollToSelected = (animated: boolean) => {
    const yearOffset = (value.getFullYear() - firstYear) * pickerItemHeight;
    const monthOffset = value.getMonth() * pickerItemHeight;
    const dayOffset = (value.getDate() - 1) * pickerItemHeight;
    yearScrollY.setValue(yearOffset);
    monthScrollY.setValue(monthOffset);
    dayScrollY.setValue(dayOffset);
    yearScrollRef.current?.scrollTo({ y: yearOffset, animated });
    monthScrollRef.current?.scrollTo({ y: monthOffset, animated });
    dayScrollRef.current?.scrollTo({ y: dayOffset, animated });
  };
  const updateYearFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / pickerItemHeight), years.length);
    setYear(years[index]);
  };
  const updateMonthFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / pickerItemHeight), months.length);
    setMonth(months[index]);
  };
  const updateDayFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / pickerItemHeight), days.length);
    setDay(days[index]);
  };

  useEffect(() => {
    const maxDay = days[days.length - 1] ?? 1;
    if (day <= maxDay) {
      return;
    }

    setDay(maxDay);
    const dayOffset = (maxDay - 1) * pickerItemHeight;
    dayScrollY.setValue(dayOffset);
    dayScrollRef.current?.scrollTo({ y: dayOffset, animated: true });
  }, [day, dayScrollY, days]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setYear(value.getFullYear());
    setMonth(value.getMonth());
    setDay(value.getDate());
    requestAnimationFrame(() => scrollToSelected(false));
  }, [firstYear, value, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <Pressable style={styles.pickerBackdropPress} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CloseIcon />
            </Pressable>
            <Text style={styles.pickerTitle}>日付</Text>
            <Pressable onPress={() => onSelect(new Date(year, month, Math.min(day, daysInMonth(new Date(year, month, 1)))))} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CheckIcon />
            </Pressable>
          </View>

          <View style={styles.datePickerColumns}>
            <Animated.ScrollView
              ref={yearScrollRef}
              style={styles.pickerColumn}
              contentContainerStyle={styles.pickerColumnContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerItemHeight}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: yearScrollY } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={updateYearFromScroll}
              onScrollEndDrag={updateYearFromScroll}
              onLayout={() => visible && requestAnimationFrame(() => scrollToSelected(false))}
            >
              {years.map((item, index) => (
                <View key={item} style={styles.pickerItem}>
                  <PickerItemText scrollY={yearScrollY} index={index}>
                    {item}年
                  </PickerItemText>
                </View>
              ))}
            </Animated.ScrollView>

            <Animated.ScrollView
              ref={monthScrollRef}
              style={styles.pickerColumn}
              contentContainerStyle={styles.pickerColumnContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerItemHeight}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: monthScrollY } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={updateMonthFromScroll}
              onScrollEndDrag={updateMonthFromScroll}
              onLayout={() => visible && requestAnimationFrame(() => scrollToSelected(false))}
            >
              {months.map((item, index) => (
                <View key={item} style={styles.pickerItem}>
                  <PickerItemText scrollY={monthScrollY} index={index}>
                    {item + 1}月
                  </PickerItemText>
                </View>
              ))}
            </Animated.ScrollView>

            <Animated.ScrollView
              ref={dayScrollRef}
              style={styles.pickerColumn}
              contentContainerStyle={styles.pickerColumnContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerItemHeight}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: dayScrollY } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={updateDayFromScroll}
              onScrollEndDrag={updateDayFromScroll}
              onLayout={() => visible && requestAnimationFrame(() => scrollToSelected(false))}
            >
              {days.map((item, index) => (
                <View key={item} style={styles.pickerItem}>
                  <PickerItemText scrollY={dayScrollY} index={index}>
                    {item}日
                  </PickerItemText>
                </View>
              ))}
            </Animated.ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TimePicker({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (time: string) => void;
}) {
  const [hour, setHour] = useState(Math.floor(minutesFromTime(value) / 60));
  const [minute, setMinute] = useState(minutesFromTime(value) % 60);
  const hourScrollRef = useRef<ScrollView | null>(null);
  const minuteScrollRef = useRef<ScrollView | null>(null);
  const hourScrollY = useRef(new Animated.Value(0)).current;
  const minuteScrollY = useRef(new Animated.Value(0)).current;
  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = useMemo(() => Array.from({ length: 6 }, (_, index) => index * 10), []);
  const clampIndex = (index: number, length: number) => Math.max(0, Math.min(length - 1, index));
  const scrollToSelected = (animated: boolean) => {
    const valueMinutes = minutesFromTime(value);
    const hourOffset = Math.floor(valueMinutes / 60) * pickerItemHeight;
    const minuteOffset = (nearestMinuteStep(valueMinutes % 60) / 10) * pickerItemHeight;
    hourScrollY.setValue(hourOffset);
    minuteScrollY.setValue(minuteOffset);
    hourScrollRef.current?.scrollTo({ y: hourOffset, animated });
    minuteScrollRef.current?.scrollTo({ y: minuteOffset, animated });
  };
  const updateHourFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / pickerItemHeight), hours.length);
    setHour(hours[index]);
  };
  const updateMinuteFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / pickerItemHeight), minutes.length);
    setMinute(minutes[index]);
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    const valueMinutes = minutesFromTime(value);
    setHour(Math.floor(valueMinutes / 60));
    setMinute(nearestMinuteStep(valueMinutes % 60));
    requestAnimationFrame(() => scrollToSelected(false));
  }, [value, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <Pressable style={styles.pickerBackdropPress} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CloseIcon />
            </Pressable>
            <Text style={styles.pickerTitle}>時刻</Text>
            <Pressable onPress={() => onSelect(`${pad(hour)}:${pad(minute)}`)} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CheckIcon />
            </Pressable>
          </View>

          <View style={styles.pickerColumns}>
            <Animated.ScrollView
              ref={hourScrollRef}
              style={styles.pickerColumn}
              contentContainerStyle={styles.pickerColumnContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerItemHeight}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: hourScrollY } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={updateHourFromScroll}
              onScrollEndDrag={updateHourFromScroll}
              onLayout={() => visible && requestAnimationFrame(() => scrollToSelected(false))}
            >
              {hours.map((item, index) => (
                <View key={item} style={styles.pickerItem}>
                  <PickerItemText scrollY={hourScrollY} index={index}>
                    {item}時
                  </PickerItemText>
                </View>
              ))}
            </Animated.ScrollView>

            <Animated.ScrollView
              ref={minuteScrollRef}
              style={styles.pickerColumn}
              contentContainerStyle={styles.pickerColumnContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={pickerItemHeight}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: minuteScrollY } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={updateMinuteFromScroll}
              onScrollEndDrag={updateMinuteFromScroll}
              onLayout={() => visible && requestAnimationFrame(() => scrollToSelected(false))}
            >
              {minutes.map((item, index) => (
                <View key={item} style={styles.pickerItem}>
                  <PickerItemText scrollY={minuteScrollY} index={index}>
                    {pad(item)}分
                  </PickerItemText>
                </View>
              ))}
            </Animated.ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NotificationPicker({
  visible,
  atTimeLabel,
  values,
  onClose,
  onSelect,
}: {
  visible: boolean;
  atTimeLabel: string;
  values: NotificationOption[];
  onClose: () => void;
  onSelect: (values: NotificationOption[]) => void;
}) {
  const [selectedValues, setSelectedValues] = useState<NotificationOption[]>(normalizeNotifications(values));
  const toggle = (value: NotificationOption) => {
    setSelectedValues((current) => {
      if (value === 'none') {
        return ['none'];
      }

      const withoutNone = current.filter((item) => item !== 'none');
      const next = withoutNone.includes(value) ? withoutNone.filter((item) => item !== value) : [...withoutNone, value];
      return next.length > 0 ? next : ['none'];
    });
  };

  useEffect(() => {
    if (visible) {
      setSelectedValues(normalizeNotifications(values));
    }
  }, [values, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <Pressable style={styles.pickerBackdropPress} onPress={onClose} />
        <View style={styles.notificationSheet}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={onClose} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CloseIcon />
            </Pressable>
            <Text style={styles.pickerTitle}>通知</Text>
            <Pressable onPress={() => onSelect(normalizeNotifications(selectedValues))} hitSlop={14} style={({ pressed }) => [styles.pickerIconButton, pressed && styles.pressed]}>
              <CheckIcon />
            </Pressable>
          </View>

          <View style={styles.notificationOptions}>
            {notificationOptions.map((option) => {
              const selected = selectedValues.includes(option.value);

              return (
                <Pressable key={option.value} onPress={() => toggle(option.value)} style={({ pressed }) => [styles.notificationOption, pressed && styles.pressed]}>
                  <View style={styles.checkbox}>
                    {selected ? <CheckIcon /> : null}
                  </View>
                  <Text style={styles.notificationOptionText}>{notificationLabel(option.value, atTimeLabel)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PickerItemText({ scrollY, index, children }: { scrollY: Animated.Value; index: number; children: ReactNode }) {
  const itemOffset = index * pickerItemHeight;
  const scale = scrollY.interpolate({
    inputRange: [itemOffset - pickerItemHeight, itemOffset, itemOffset + pickerItemHeight],
    outputRange: [1, 1.16, 1],
    extrapolate: 'clamp',
  });
  const opacity = scrollY.interpolate({
    inputRange: [itemOffset - pickerItemHeight, itemOffset, itemOffset + pickerItemHeight],
    outputRange: [0.28, 1, 0.28],
    extrapolate: 'clamp',
  });

  return <Animated.Text style={[styles.pickerItemText, { opacity, transform: [{ scale }] }]}>{children}</Animated.Text>;
}

function ScheduleTimeline({ events, selectedDate, onSelectEvent }: { events: CalendarEvent[]; selectedDate: string; onSelectEvent: (event: CalendarEvent) => void }) {
  const groups = useMemo(() => buildScheduleTimelineGroups(events, selectedDate), [events, selectedDate]);
  const multiDayEvents = useMemo(() => events.filter(isMultiDayEvent), [events]);
  const hasSingleDayEvents = events.some((event) => !isMultiDayEvent(event));
  const showMultiDayOverlay = multiDayEvents.length > 0 && hasSingleDayEvents;
  const groupHeights = useMemo(() => groups.map(scheduleGroupHeight), [groups]);
  const timelineHeight = groupHeights.reduce((total, height) => total + height, 0) + Math.max(0, groupHeights.length - 1) * scheduleTimelineGroupGap;
  const columnCount = groups[0]?.columnCount ?? Math.max(1, multiDayEvents.length);

  return (
    <View style={styles.scheduleTimeline}>
      {showMultiDayOverlay ? (
        <View pointerEvents="box-none" style={[styles.scheduleTimelineOverlay, { height: timelineHeight }]}>
          {multiDayEvents.map((event, index) => (
            <View
              key={event.id}
              style={[
                styles.scheduleTimelineCardSlot,
                {
                  top: 0,
                  height: timelineHeight,
                  left: `${(index / columnCount) * 100}%`,
                  width: `${100 / columnCount}%`,
                },
              ]}
            >
              <Pressable onPress={() => onSelectEvent(event)} style={({ pressed }) => [styles.scheduleTimelineCard, pressed && styles.pressed]}>
                <Text style={styles.scheduleTitle} numberOfLines={2} ellipsizeMode="tail">
                  {event.title}
                </Text>
                <Text style={styles.scheduleCardEndTime} numberOfLines={isMultiDayEvent(event) ? 2 : 1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.85}>
                  {formatScheduleEndLabel(event)}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {groups.map((group) => (
        <ScheduleTimelineGroupView key={group.id} group={group} onSelectEvent={onSelectEvent} />
      ))}
    </View>
  );
}

const scheduleGroupHeight = (group: ScheduleTimelineGroup) => {
  const entryBottoms = group.entries.map((entry) => scheduleEntryTop(entry, group) + scheduleEntryHeight(entry));
  return Math.max(scheduleMinCardHeight, ...entryBottoms);
};

const scheduleEntryTop = (entry: ScheduleTimelineEntry, group: ScheduleTimelineGroup) =>
  Math.max(0, (entry.start - group.start) * schedulePixelsPerMinute);

const scheduleEntryHeight = (entry: ScheduleTimelineEntry) =>
  Math.max(scheduleMinCardHeight, (entry.end - entry.start) * schedulePixelsPerMinute);

const scheduleEntryHasPreviousNeighbor = (entry: ScheduleTimelineEntry, group: ScheduleTimelineGroup) =>
  group.entries.some((candidate) => {
    if (candidate.end !== entry.start) return false;

    const entryRight = entry.column + entry.columnSpan;
    const candidateRight = candidate.column + candidate.columnSpan;
    return candidate.column < entryRight && candidateRight > entry.column;
  });

function ScheduleTimelineGroupView({
  group,
  onSelectEvent,
}: {
  group: ScheduleTimelineGroup;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const groupHeight = scheduleGroupHeight(group);
  const markerStarts = Array.from(new Set(group.entries.map((entry) => entry.start))).sort((first, second) => first - second);

  return (
    <View style={[styles.scheduleTimelineGroup, { minHeight: groupHeight }]}>
      <View style={[styles.scheduleTimelineTimes, { height: groupHeight }]}>
        {markerStarts.map((start) => (
          <Text key={start} style={[styles.scheduleStart, styles.scheduleTimelineTimeLabel, { top: Math.max(0, (start - group.start) * schedulePixelsPerMinute) }]}>
            {formatTimelineTime(start)}
          </Text>
        ))}
      </View>
      <View style={[styles.scheduleTimelineMarker, { height: groupHeight }]}>
        <View style={styles.scheduleLine} />
        {markerStarts.map((start) => (
          <View key={start} style={[styles.scheduleDot, { top: Math.max(0, (start - group.start) * schedulePixelsPerMinute) + 4 }]} />
        ))}
      </View>
      <View style={[styles.scheduleTimelineCards, { height: groupHeight }]}>
        {group.entries.map((entry) => {
          const previousNeighborInset = scheduleEntryHasPreviousNeighbor(entry, group) ? scheduleTimelineGroupGap : 0;
          const top = scheduleEntryTop(entry, group) + previousNeighborInset;
          const height = Math.max(1, scheduleEntryHeight(entry) - previousNeighborInset);
          const compactCard = group.columnCount >= 3 || height < 74;

          return (
            <View
              key={entry.event.id}
              style={[
                styles.scheduleTimelineCardSlot,
                compactCard && styles.scheduleTimelineCardSlotCompact,
                {
                  top,
                  height,
                  left: `${(entry.column / group.columnCount) * 100}%`,
                  width: `${(entry.columnSpan / group.columnCount) * 100}%`,
                },
              ]}
            >
              <Pressable
                onPress={() => onSelectEvent(entry.event)}
                style={({ pressed }) => [styles.scheduleTimelineCard, compactCard && styles.scheduleTimelineCardCompact, pressed && styles.pressed]}
              >
                <Text style={[styles.scheduleTitle, compactCard && styles.scheduleTitleCompact]} numberOfLines={compactCard ? 1 : 2} ellipsizeMode="tail">
                  {entry.event.title}
                </Text>
                <Text style={[styles.scheduleCardEndTime, compactCard && styles.scheduleCardEndTimeCompact]} numberOfLines={isMultiDayEvent(entry.event) ? 2 : 1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.85}>
                  {formatScheduleEndLabel(entry.event)}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EventForm({
  draft,
  onChange,
  onOpenDatePicker,
  onOpenTimePicker,
  onOpenNotificationPicker,
}: {
  draft: EventDraft;
  onChange: (draft: EventDraft) => void;
  onOpenDatePicker: (key?: TimeFieldKey) => void;
  onOpenTimePicker: (key: TimeFieldKey) => void;
  onOpenNotificationPicker: (key?: TimeFieldKey) => void;
}) {
  const updateText = (key: 'title', value: string) => onChange({ ...draft, [key]: value });

  return (
    <ScrollView style={styles.formScreen} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <FormField label="タイトル" value={draft.title} onChangeText={(value) => updateText('title', value)} autoFocus />
      <DateTimeFormField
        label="開始"
        date={formatFullDate(draft.date)}
        time={draft.start}
        onPressDate={() => onOpenDatePicker('start')}
        onPressTime={() => onOpenTimePicker('start')}
      />
      <DateTimeFormField
        label="終了"
        date={formatFullDate(draft.endDate)}
        time={draft.end}
        onPressDate={() => onOpenDatePicker('end')}
        onPressTime={() => onOpenTimePicker('end')}
      />
      <NotificationFormField value={formatNotificationSummary(draft.startNotifications, '開始時刻')} onPress={onOpenNotificationPicker} />
    </ScrollView>
  );

  return (
    <ScrollView style={styles.formScreen} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <FormField label="タイトル" value={draft.title} onChangeText={(value) => updateText('title', value)} autoFocus />
      <DateFormField label="日付" value={formatFullDate(draft.date)} onPress={onOpenDatePicker} />
      <TimeNotificationRow
        label="開始"
        time={draft.start}
        notificationSummary={formatNotificationSummary(draft.startNotifications, '開始時刻')}
        onPressTime={() => onOpenTimePicker('start')}
        onPressNotification={() => onOpenNotificationPicker('start')}
      />
      <TimeNotificationRow
        label="終了"
        time={draft.end}
        notificationSummary={formatNotificationSummary(draft.endNotifications, '終了時刻')}
        onPressTime={() => onOpenTimePicker('end')}
        onPressNotification={() => onOpenNotificationPicker('end')}
      />
    </ScrollView>
  );
}

function DateFormField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.formField, pressed && styles.pressed]}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.dateFormValue}>
        <Text style={styles.dateFormValueText}>{value}</Text>
        <DownChevron />
      </View>
    </Pressable>
  );
}

function DateTimeFormField({
  label,
  date,
  time,
  onPressDate,
  onPressTime,
}: {
  label: string;
  date: string;
  time: string;
  onPressDate: () => void;
  onPressTime: () => void;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.dateTimeFormRow}>
        <Pressable onPress={onPressDate} style={({ pressed }) => [styles.dateTimeDateValue, pressed && styles.pressed]}>
          <Text style={styles.dateFormValueText}>{date}</Text>
          <DownChevron />
        </Pressable>
        <Pressable onPress={onPressTime} style={({ pressed }) => [styles.dateTimeTimeValue, pressed && styles.pressed]}>
          <Text style={styles.dateFormValueText}>{time}</Text>
          <DownChevron />
        </Pressable>
      </View>
    </View>
  );
}

function NotificationFormField({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>通知</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.notificationFormValue, pressed && styles.pressed]}>
        <Text style={styles.notificationFormValueText} numberOfLines={1} ellipsizeMode="tail">
          {value}
        </Text>
        <DownChevron />
      </Pressable>
    </View>
  );
}

function TimeNotificationRow({
  label,
  time,
  notificationSummary,
  onPressTime,
  onPressNotification,
}: {
  label: string;
  time: string;
  notificationSummary: string;
  onPressTime: () => void;
  onPressNotification: () => void;
}) {
  return (
    <View style={styles.formField}>
      <View style={styles.timeNotificationLabels}>
        <Text style={[styles.formLabel, styles.timeLabel]}>{label}</Text>
        <Text style={[styles.formLabel, styles.notificationLabel]}>通知</Text>
      </View>
      <View style={styles.timeNotificationRow}>
        <Pressable onPress={onPressTime} style={({ pressed }) => [styles.timeFormValue, pressed && styles.pressed]}>
          <Text style={styles.dateFormValueText}>{time}</Text>
          <DownChevron />
        </Pressable>
        <Pressable onPress={onPressNotification} style={({ pressed }) => [styles.notificationFormValue, pressed && styles.pressed]}>
          <Text style={styles.notificationFormValueText} numberOfLines={1} ellipsizeMode="tail">
            {notificationSummary}
          </Text>
          <DownChevron />
        </Pressable>
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  compact,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
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
        style={styles.formInput}
      />
    </View>
  );
}

const createAppTokens = (theme: ThemePalette) => ({
  background: theme.background,
  surface: theme.surface,
  subtleSurface: theme.surface,
  text: '#222222',
  secondaryText: '#777777',
  tertiaryText: '#AAAAAA',
  disabledText: '#CFCFCB',
  hairline: theme.border,
  divider: theme.border,
  selected: theme.dot,
  dot: theme.dot,
  destructive: '#9B6A62',
});

let tokens = createAppTokens(defaultTheme);

const createStyles = (themeTokens: ReturnType<typeof createAppTokens>) => {
  const tokens = themeTokens;

  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  page: {
    flex: 1,
    backgroundColor: tokens.background,
    paddingTop: 66,
  },
  pageCompact: {
    paddingTop: 56,
  },
  calendarLayer: {
    flex: 1,
  },
  calendarStack: {
    flex: 1,
  },
  calendarFadeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    height: 58,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  monthTitleButton: {
    minWidth: 120,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
  },
  centerMonthTitleButton: {
    position: 'absolute',
    left: 96,
    right: 96,
    top: 8,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerSide: {
    width: 52,
  },
  headerActions: {
    width: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerActionsWide: {
    width: 88,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  downChevronIcon: {
    width: 12,
    height: 24,
    position: 'relative',
    marginTop: 3,
  },
  downChevronLineLeft: {
    position: 'absolute',
    left: 2,
    top: 10,
    width: 6,
    height: 1.6,
    borderRadius: 1,
    backgroundColor: tokens.secondaryText,
    transform: [{ rotate: '45deg' }],
  },
  downChevronLineRight: {
    position: 'absolute',
    right: 1.5,
    top: 10,
    width: 6,
    height: 1.6,
    borderRadius: 1,
    backgroundColor: tokens.secondaryText,
    transform: [{ rotate: '-45deg' }],
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
  selectedDateCircleFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: tokens.selected,
  },
  dateText: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  scheduleScroll: {
    flex: 1,
  },
  scheduleList: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 88,
  },
  selectedDateText: {
    color: tokens.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '400',
    marginBottom: 28,
  },
  scheduleTimeline: {
    gap: scheduleTimelineGroupGap,
    position: 'relative',
  },
  scheduleTimelineOverlay: {
    position: 'absolute',
    left: 116,
    right: 0,
    top: 0,
    zIndex: 2,
  },
  scheduleTimelineGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  scheduleTimelineTimes: {
    width: 58,
    position: 'relative',
    paddingTop: 0,
    paddingBottom: 0,
  },
  scheduleTimelineTimeLabel: {
    position: 'absolute',
    left: 0,
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
  scheduleTimelineMarker: {
    width: 40,
    position: 'relative',
  },
  scheduleDot: {
    position: 'absolute',
    left: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.dot,
  },
  scheduleLine: {
    position: 'absolute',
    top: 22,
    bottom: 0,
    left: 19.5,
    width: 1,
    backgroundColor: tokens.hairline,
  },
  scheduleTimelineCards: {
    flex: 1,
    position: 'relative',
    marginLeft: 18,
  },
  scheduleTimelineCardSlot: {
    position: 'absolute',
    paddingHorizontal: 3,
  },
  scheduleTimelineCardSlotCompact: {
    paddingHorizontal: 2,
  },
  scheduleTimelineCard: {
    flex: 1,
    borderRadius: 7,
    backgroundColor: tokens.subtleSurface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  scheduleTimelineCardCompact: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  scheduleTitle: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  scheduleTitleCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  scheduleCardEndTime: {
    color: tokens.tertiaryText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  scheduleCardEndTimeCompact: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
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
  pickerBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerSheet: {
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: tokens.hairline,
    borderWidth: 1,
    paddingBottom: 34,
  },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(34, 34, 34, 0.18)',
    justifyContent: 'flex-end',
  },
  settingsBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsSheet: {
    height: '94%',
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 28,
    paddingBottom: 30,
    boxShadow: '0 -10px 34px rgba(0, 0, 0, 0.08)',
    position: 'relative',
  },
  settingsCloseButton: {
    position: 'absolute',
    top: 22,
    right: 28,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  settingsHandle: {
    width: 66,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D8D8D6',
    alignSelf: 'center',
    marginBottom: 30,
  },
  settingsTitle: {
    color: tokens.secondaryText,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 34,
  },
  settingsContent: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  settingsSection: {
    marginBottom: 36,
  },
  settingsRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  settingsRowText: {
    flex: 1,
  },
  settingsRowTitle: {
    color: tokens.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '400',
  },
  settingsChevron: {
    width: 24,
    color: tokens.tertiaryText,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '200',
    textAlign: 'right',
  },
  themeScreen: {
    flex: 1,
  },
  themeContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 54,
  },
  themeIntro: {
    color: tokens.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 22,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  themeOption: {
    width: '48.2%',
    minHeight: 188,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    position: 'relative',
    overflow: 'visible',
  },
  themeSelectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#777773',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  themeSelectedCheck: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
  },
  themePreview: {
    height: 145,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingTop: 7,
    overflow: 'hidden',
  },
  themePreviewHeader: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themePreviewMonth: {
    color: tokens.text,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '500',
  },
  themePreviewWeekdays: {
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  themePreviewWeekday: {
    flex: 1,
    color: tokens.tertiaryText,
    fontSize: 5,
    lineHeight: 8,
    textAlign: 'center',
  },
  themePreviewDates: {
    height: 23,
    flexDirection: 'row',
    alignItems: 'center',
  },
  themePreviewDateCell: {
    flex: 1,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  themePreviewSelectedDate: {
    position: 'absolute',
    width: 19,
    height: 19,
    borderRadius: 10,
  },
  themePreviewDate: {
    color: tokens.secondaryText,
    fontSize: 6,
    lineHeight: 9,
    fontVariant: ['tabular-nums'],
  },
  themePreviewTimeline: {
    flex: 1,
    paddingTop: 5,
    gap: 3,
  },
  themePreviewTimelineRow: {
    flex: 1,
    minHeight: 33,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  themePreviewTime: {
    width: 29,
    color: tokens.text,
    fontSize: 6,
    lineHeight: 9,
    fontVariant: ['tabular-nums'],
  },
  themePreviewRail: {
    width: 17,
    alignItems: 'center',
    position: 'relative',
  },
  themePreviewDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    zIndex: 1,
  },
  themePreviewLine: {
    position: 'absolute',
    top: 8,
    bottom: -4,
    width: 1,
  },
  themePreviewCardsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  themePreviewCard: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  themePreviewCardWide: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  themePreviewCardTitle: {
    color: tokens.text,
    fontSize: 6,
    lineHeight: 8,
  },
  themePreviewCardTime: {
    color: tokens.tertiaryText,
    fontSize: 5,
    lineHeight: 7,
    marginTop: 2,
  },
  themeOptionName: {
    color: tokens.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    textAlign: 'center',
    paddingTop: 9,
    paddingBottom: 2,
  },
  proScreen: {
    flex: 1,
  },
  proContent: {
    paddingHorizontal: 30,
    paddingTop: 78,
    paddingBottom: 44,
  },
  proHero: {
    marginBottom: 58,
  },
  proHeroTitle: {
    color: tokens.text,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '300',
  },
  proFeatureList: {
    marginBottom: 62,
  },
  proFeatureRow: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  proFeatureText: {
    flex: 1,
  },
  proFeatureTitle: {
    color: tokens.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  proChevron: {
    width: 24,
    color: tokens.tertiaryText,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '200',
    textAlign: 'right',
  },
  proPlanSection: {
    marginBottom: 64,
  },
  proSectionLabel: {
    color: tokens.tertiaryText,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 18,
  },
  proPlanCard: {
    borderWidth: 1,
    borderColor: tokens.hairline,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: tokens.surface,
  },
  proPlanRow: {
    minHeight: 66,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proPlanName: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  proPlanValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  proPlanPrice: {
    color: tokens.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  proPlanCheck: {
    color: tokens.secondaryText,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '400',
  },
  proCancelText: {
    color: tokens.tertiaryText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
    marginTop: 18,
  },
  proActions: {
    gap: 22,
    alignItems: 'center',
  },
  proStartButton: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.divider,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: tokens.surface,
  },
  proStartButtonText: {
    color: tokens.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  proRestoreText: {
    color: tokens.tertiaryText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  notificationSettingsScreen: {
    flex: 1,
  },
  notificationSettingsContent: {
    paddingHorizontal: 30,
    paddingTop: 96,
    paddingBottom: 64,
  },
  notificationSettingsGroup: {
    marginBottom: 46,
  },
  notificationSettingsRow: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  notificationSettingsTitle: {
    color: tokens.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  notificationSwitchFrame: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationSettingsValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationSettingsValue: {
    color: tokens.secondaryText,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  notificationSettingsChevron: {
    color: tokens.tertiaryText,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '200',
  },
  backupScreen: {
    flex: 1,
  },
  backupContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 96,
    paddingBottom: 64,
  },
  backupList: {
  },
  backupRow: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  backupRowTitle: {
    color: tokens.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
  },
  backupSwitchFrame: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupChevron: {
    color: tokens.tertiaryText,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '200',
  },
  backupDescription: {
    marginTop: 'auto',
    paddingTop: 42,
    gap: 12,
  },
  backupDescriptionText: {
    color: tokens.tertiaryText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  notificationSheet: {
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: tokens.hairline,
    borderWidth: 1,
    paddingBottom: 28,
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
  pickerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    color: tokens.secondaryText,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '300',
  },
  checkIconText: {
    color: tokens.secondaryText,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '400',
  },
  pickerColumns: {
    height: pickerColumnHeight,
    flexDirection: 'row',
    paddingHorizontal: 48,
    paddingTop: 16,
    gap: 28,
  },
  datePickerColumns: {
    height: pickerColumnHeight,
    flexDirection: 'row',
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: 16,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerColumnContent: {
    paddingVertical: (pickerColumnHeight - pickerItemHeight) / 2,
  },
  pickerItem: {
    height: pickerItemHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    color: tokens.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  notificationOptions: {
    paddingHorizontal: 30,
    paddingTop: 10,
  },
  notificationOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationOptionText: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  addButton: {
    position: 'absolute',
    right: 28,
    bottom: 34,
    width: 60,
    height: 60,
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
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
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
  dateFormValue: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: tokens.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dateFormValueText: {
    color: tokens.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  dateTimeFormRow: {
    flexDirection: 'row',
    gap: 14,
  },
  dateTimeDateValue: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: tokens.hairline,
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dateTimeTimeValue: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: tokens.hairline,
    flex: 0.75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  timeNotificationRow: {
    flexDirection: 'row',
    gap: 18,
  },
  timeNotificationLabels: {
    flexDirection: 'row',
    gap: 18,
  },
  timeLabel: {
    flex: 0.72,
  },
  notificationLabel: {
    flex: 1,
  },
  timeFormValue: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: tokens.hairline,
    flex: 0.72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  notificationFormValue: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: tokens.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
  },
  notificationFormValueText: {
    color: tokens.secondaryText,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.58,
  },
  disabled: {
    opacity: 0.38,
  },
  });
};

let styles = createStyles(tokens);
