# Accessibility verification checklist

This checklist complements the automated accessibility-prop tests. Run it on a release build before shipping changes that affect navigation, controls, or media.

## Screen readers

- iOS VoiceOver: confirm the focus order is back/header, screen content, form fields, primary action, then secondary actions. Open each bottom sheet and confirm its title is announced and receives focus; the close button must be next.
- Android TalkBack: repeat registration, login, feed post actions, events, courts, messages, profile/settings, communities, and notifications. Confirm every icon-only control has a useful action name and every input announces its label.
- Confirm chips announce as buttons with their selected state, segmented controls announce checked radio options, and notification/message settings announce switch state.
- Privacy (PrivacyScreen) and Settings (SettingsScreen) toggles and rows:
  - VoiceOver: focus the Private account row and confirm it announces as "Private account, switch, off" with the hint "Only followers can see public posts."; double-tap and confirm it announces "on" once the update completes.
  - TalkBack: focus the same row and confirm it announces as "Private account, switch, not checked" and that it is disabled ("dimmed") while the update is in flight, then re-enabled and "checked" on success.
  - Confirm settings rows announce as buttons with label and detail (e.g. "Privacy & Security. Account visibility, block list") in one swipe, without re-announcing the chevron or icon.
  - Confirm Sign Out announces as a button labeled "Sign Out" with its hint, is disabled and "busy" while signing out, and returns to enabled when sign-out fails.
  - Swipe from the top: Back, then each section row in visual order, ending at Sign Out. Confirm the chevron and icons add no extra focus stops.
  - Confirm the 44 pt minimum touch target on every row (Private account, settings rows, Sign Out) using the platform accessibility inspector, including with the largest system font.
- In Stories, enable Reduce Motion. Images must wait for a manual tap instead of auto-advancing and videos must not auto-play. Confirm manual navigation and reply controls remain reachable.

## Large text and contrast

- Test the largest supported system font setting on iOS and Android in light and dark themes. Registration, login, compose screens, filter sheets, event booking, and settings must retain a visible, reachable primary action without clipped labels.
- Verify text, controls, disabled states, error messages, and icon-only controls against their backgrounds with the platform accessibility inspector. Address any contrast failure before release.

## Web keyboard

- Navigate each core flow with Tab and Shift+Tab. Focus must be visible and follow the same order as screen-reader navigation.
- Activate buttons, chips, cards, radios, and switches using Enter and Space. Confirm segmented controls announce their checked option.
- Open a bottom sheet with the keyboard, confirm focus enters at its title/close control, then close it with its close button or Escape where the browser provides it.

## Automated coverage

`src/__tests__/accessibility.test.tsx` verifies accessible names, selected/checked states, icon-only labels, modal title/close controls, focus-order-sensitive FAQ controls, and scalable button targets. Run it with:

```bash
npm test -- --runInBand accessibility.test.tsx
```
