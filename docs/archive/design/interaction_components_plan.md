# Phase 2: Interaction Components Implementation Plan

## Goal
To elevate the user experience from "Functional" to "Premium" by standardizing interaction patterns. The focus is on **Modals** (Dialogs) and **Form Elements** (Input, Select).

## 1. Dialog (Modal) Component
**Path**: `components/ui/Dialog.tsx`

**Features**:
- **Unified Overlay**: `bg-black/50 backdrop-blur-sm` with fade-in animation.
- **Responsive Layout**:
  - **Desktop**: Centered Modal (`zoom-in-95`).
  - **Mobile**: Bottom Sheet (`slide-in-from-bottom`).
- **Portal Support**: Render into `document.body` (optional but recommended, sticking to simple z-index for now if Portal overhead is high, but Portal is better for z-index wars. Given "minimal deps", we can use a simple Portal helper or just standard stacking context if the layout allows. *Decision: Simple Z-Index for now as App.tsx layout is clean.*)
- **Props**:
  - `isOpen`: boolean
  - `onClose`: () => void
  - `title`: string
  - `children`: ReactNode
  - `footer`: ReactNode (optional buttons)

## 2. Input Component
**Path**: `components/ui/Input.tsx`

**Features**:
- **Design**:
  - `rounded-xl` (slightly less rounded than Buttons/Cards).
  - `border-slate-200` default.
  - **Focus State**: `ring-2 ring-primary/20 border-primary` transition.
- **Variants**:
  - `default`: Standard text input.
  - `ghost`: Transparent for seamless editing.
- **Props**: Standard HTMLInputProps + `label?`, `error?`.

## 3. Select Component
**Path**: `components/ui/Select.tsx`

**Features**:
- **Design**: Matching `Input` style.
- **Icon**: Custom Chevron using pure CSS or SVG.
- **Props**: Standard HTMLSelectProps + `label?`, `error?`, `options: {label, value}[]`.

## 4. Refactoring Targets
- **BillManager.tsx**: Replace custom modal div and native inputs.
- **SmartInput.tsx**: Replace native inputs (Phase 3 task, but can prepare now).
- **Dashboard.tsx** (Budget Modal): Replace inline modal.
