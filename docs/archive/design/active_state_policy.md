# Active State Policy Report

## 1. Overview
This report defines the visual states for interactive elements when they are in their **"Active" (Selected)** state. This ensures users clearly understand "Where am I?" and "What is currently applied?".

## 2. Sidebar Navigation Buttons

### Selected State (Current Page)
*   **Background**: `bg-slate-900` (Primary Brand Color)
*   **Text Color**: `text-white`
*   **Icon Color**: `text-white` (Consistent with text)
*   **Shadow**: `shadow-md` (Soft depth to indicate "pressed/active" persistence)
    *   *Note: Current implementation uses `shadow-blue-200` glow; recommend simplifying to standard dark shadow or removing glow for cleaner look.*
*   **Shape**: `rounded-2xl` (Matches global interactions)

### Unselected State (Default)
*   **Background**: Transparent (`bg-transparent`)
*   **Text/Icon**: `text-slate-500` (Muted)
*   **Hover**: `bg-slate-100` (Subtle gray fill)

---

## 3. Category & Filter Buttons (Pills)

### Selected State (Filter Applied)
*   **Background**: `bg-slate-900` (Primary)
    *   *Exception*: For specific Asset filters, `bg-slate-900` is preferred for consistency, though `bg-blue-600` exists in legacy code (marked for removal).
*   **Text**: `text-white`
*   **Shape**: `rounded-full` (Pill Policy)
*   **Shadow**: `shadow-md` (Lifts the active filter)
*   **Scale**: `scale-105` (Slightly larger to emphasize selection)

### Unselected State
*   **Background**: `bg-white`
*   **Border**: `border border-slate-100` (Thin subtle border)
*   **Text**: `text-slate-500`

---

## 4. Interaction Feedback (Clicking)
*   **Pressed (:active)**: All buttons scale down (`scale-95`) momentarily to provide tactile feedback.
*   **Hover**: All desktop interactive elements darken their background or show a secondary fill (`bg-slate-100` or `bg-slate-800`).
