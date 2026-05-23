# Task 4 Note: Global Hotkeys & Settings Drawer

## Decisions made (not in spec)
- Programmed escaping from inputs/textareas to automatically blur active elements so global hotkeys can immediately react again.
- Auto-injected the `.wf-root` class in `settings.js` to ensure wireframe styles attach perfectly.

## Spec deviations
- none

## Tradeoffs accepted
- Checkbox elements are styled using modern native inputs alongside visual flex containers. This ensures optimal accessibility with zero visual trade-offs.

## Assumptions
- Assumed `window.matchMedia` is globally available for auto-detecting user motion reduction preference.

## Follow-ups for human
- none
