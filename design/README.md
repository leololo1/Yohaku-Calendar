# Yohaku Calendar Design Documents

This directory defines the design rules for Yohaku Calendar.

Yohaku Calendar is a quiet, minimal calendar app.
It is designed to feel like a blank white space where only necessary schedules are placed gently.

These documents must be treated as the source of truth for UI design decisions.

---

## Document Structure

### `philosophy.md`

Defines the core design philosophy.

Read this first before implementing any UI.

This file explains:
- what Yohaku Calendar is
- what kind of feeling the app should have
- how to decide whether a UI element should exist
- the relationship between usability and visual restraint

---

### `tokens.md`

Defines visual tokens.

This file includes:
- colors
- typography
- spacing
- border radius
- shadows
- line styles

Use these values as much as possible when implementing UI.

---

### `components.md`

Defines reusable UI component rules.

This file includes:
- floating add button
- icon buttons
- calendar date cells
- selected date
- event dots
- schedule rows
- event blocks
- forms
- detail rows

Use this file when building or modifying UI components.

---

### `screens.md`

Defines screen-level layout rules.

This file includes:
- month calendar screen
- day schedule screen
- event detail screen
- add event screen
- edit event screen
- settings screen

Use this file when implementing full screens.

---

### `motion.md`

Defines interaction and animation rules.

This file includes:
- page transitions
- tap feedback
- month switching
- modal behavior
- delete behavior
- animation style

Motion must remain calm and subtle.

---

### `anti-patterns.md`

Defines what must not be added.

This file is very important.

Yohaku Calendar must not become a colorful, busy, productivity-heavy calendar app.

When in doubt, check this file before adding a new UI element or feature.

---

## Core Principle

The core design principle is:

> Remove anything that does not need to exist.

Yohaku Calendar should not feel like a dashboard.
It should not feel like Google Calendar.
It should not feel like a task management app.

It should feel like:

- a blank page
- a quiet room
- a white notebook
- a high-end paper calendar
- a calm place to place future events

---

## App Identity

App name:

```text
Yohaku Calendar