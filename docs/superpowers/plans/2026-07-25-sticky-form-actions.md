# Sticky Form Actions Implementation Plan

> Inline execution on current branch.

**Goal:** Viewport-fixed bottom action bar for filler + admin long forms.

**Architecture:** Shared `FormStickyActions` wrapper; filler moves Save from header into it; admin moves bottom `Group` into it.

## Tasks

1. Create `FormStickyActions` + tests
2. Wire `FillerEditorShell` (footer save; header keeps title/badge)
3. Wire admin Member/Temple form pages
4. Commit
