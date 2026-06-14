# Yohaku Calendar Screen Rules

## Month Calendar Screen

The main screen should show:

- Month
- Minimal calendar grid
- Selected date
- Schedule list for the selected date
- Floating add button

The screen should not show:

- motivational text
- weather
- task counters
- category summaries
- colorful dots
- analytics
- progress
- unnecessary headings

### Month Header

Keep the month header small and quiet.

Example:

```text
2025蟷ｴ5譛・
```

A small chevron may be used if month selection is available.

Do not use large headings like:

```text
Calendar
Today
My Schedule
```

### Calendar Grid

Use the calendar grid component rules from `components.md`.

### Schedule List

Below the calendar, show schedules for the selected date.

Use the schedule row component rules from `components.md`.

---

## Day Schedule Screen

The day schedule screen may show a vertical time axis.

Rules:

- Time labels must be small and gray
- Event blocks must be very pale
- Event blocks should have soft corners
- Lines must be extremely subtle
- The plus button should be small and quiet

Do not use strong colored blocks.

---

## Event Detail Screen

The event detail screen must be sparse.

Show only essential fields:

- Title
- Date
- Time
- Location
- Memo
- Notification
- Edit button

Do not show unused fields.

If a field is empty, hide it instead of showing placeholder noise.

Example layout:

```text
謇薙■蜷医ｏ縺・

2025蟷ｴ5譛・0譌･・育↓・・
10:00 - 11:00

莨夊ｭｰ螳､A

繝励Ο繧ｸ繧ｧ繧ｯ繝医・騾ｲ謐礼｢ｺ隱阪→
莉雁ｾ後・騾ｲ繧∵婿縺ｫ縺､縺・※縲・
```

Use icons only if they are very thin and minimal.
Text-only layout is preferred.

---

## Add Event Screen

The add screen should feel like writing on blank paper.

Required fields:

- Title
- Date
- Start time
- End time

Optional fields:

- Location
- Memo
- Notification

Avoid complex forms.
Do not show too many controls at once.
Place save and close actions quietly at the top.
Avoid large primary buttons.

---

## Edit Event Screen

Use the same visual rules as the add event screen.

Keep the screen sparse, quiet, and focused on editing only the existing event details.

---

## Settings Screen

Settings should stay minimal and text-led.

Only include settings that are necessary for the app to function.

Avoid dashboard-like preference panels, decorative explanations, and feature promotion.
