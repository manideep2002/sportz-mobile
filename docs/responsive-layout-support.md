# Responsive layout support

## Width classes and targets

| Class | Logical width | Supported targets | Layout contract |
| --- | ---: | --- | --- |
| Compact | 0–599 | Phones, narrow foldable panes | Single column; 16-point gutter |
| Medium | 600–1023 | Tablets portrait, large phones landscape, foldables | Single/stacked detail layout; 24-point gutter |
| Expanded | 1024–1439 | Tablets landscape, small desktop/web | Split panes where useful; centered content |
| Wide | 1440+ | Desktop/web | Split panes with a 1180-point maximum |

The phone baseline is 320 logical points. Supported test targets are phone portrait and landscape, tablet
portrait and landscape, and desktop widths of 1024, 1280, and 1440. Content forms cap at 560, ordinary
content at 760, feeds at 720, and split/detail surfaces at 1180.

`useResponsiveLayout` reads live window dimensions and font scale. It does not cache the initial orientation,
so rotation, browser resizing, split-screen resizing, and foldable pane changes update styles without
remounting navigation. Split panes are disabled at accessibility font scale 1.3 or greater to protect primary
actions from clipping.

Message drafts are stored per conversation outside the pane component. Moving between compact and expanded
layouts therefore preserves unsent text. Core screen state remains owned by the mounted screen or its store,
not by width-specific branches.

React Native `Pressable` controls retain button roles and native keyboard activation on web. Scroll surfaces
use `keyboardShouldPersistTaps="handled"`, controls remain in document order, and pointer users receive the
same actions as touch users.

## Manual visual regression matrix

Capture Feed, Profile, Event Detail, Court Detail, Group/Page Detail, Settings, Messages list, and Messages
split view at:

- 390×844 and 844×390, font scales 1.0 and 1.6
- 768×1024 and 1024×768, font scales 1.0 and 1.6
- 1024×768, 1280×800, and 1440×900 on web
- a runtime drag from 1440 down to 320 while a message draft and a partially edited settings form exist

Confirm no horizontal clipping, unreachable actions, edge-to-edge desktop stretching, state loss, or safe
area overlap. On web, tab through every primary action and activate it with Enter and Space.
