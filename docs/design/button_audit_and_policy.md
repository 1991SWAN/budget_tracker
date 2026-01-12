# 버튼 종합 감사 및 디자인 정책 수립 (Button Audit & Policy)

**작성일**: 2026-01-10
**목적**: 앱 전체의 버튼 일관성 확보를 위한 현황 분석 및 확정 정책 수립.

## 1. 현황 분석 (Current Status Audit)
코드 전수 조사 결과, 다음과 같은 3가지 주요 문제점이 발견되었습니다.

### A. 구현 방식의 혼재 (Implementation Mix)
*   **컴포넌트 사용**: `BillManager`, `GoalManager` 등 최근 수정된 곳은 `<Button>` 컴포넌트 사용.
*   **Raw HTML 사용**: `FilterBar`, `TrendsTab`, `Dashboard` 탭, `Sidebar` 등은 여전히 `className`이 하드코딩된 `<button>` 태그 사용.
    *   *문제점*: 디자인 변경 시 모든 파일을 찾아다니며 수정해야 함.

### B. 형태의 불일치 (Shape Inconsistency)
*   **Action Buttons**: 일부는 `rounded-2xl`, 일부는 `rounded-lg` (예: 모달의 Save/Cancel).
*   **Tabs/Chips**: 개념적으로 동일한 탭이 `rounded-full` (AssetManager)과 `rounded-lg` (Dashboard)로 나뉨.
*   **Icon Buttons**: 닫기(X) 버튼 등이 `rounded-full`, `rounded-lg`로 제각각임.

### C. 의미론적 혼동 (Semantic Confusion)
*   탭(Tab) 역할을 하는 요소가 버튼 스타일을 가지고 있거나, 그 반대의 경우가 존재.

---

## 2. 확정 디자인 정책 (Final Design Policy)

### A. 기술 원칙 (Technical Principle)
**"모든 버튼은 `<Button />` 컴포넌트를 사용한다"**
*   HTML `<button>` 태그 직접 사용 금지 (접근성 및 스타일 통일 목적).
*   커스텀 스타일이 필요한 경우 `variant="ghost"`나 `className` 오버라이딩을 사용하되, 기본 `baseStyles`를 유지.

### B. 형태 규칙 (Shape Rules)

| 유형 (Type) | 형태 (Shape) | 적용 대상 (Target) | 예시 |
| :--- | :--- | :--- | :--- |
| **Action Button** | **`rounded-2xl`** | 사용자의 행동을 유발하는 일반 버튼 | Add Bill, Save, Confirm, Login |
| **Pill / Tab** | **`rounded-full`** | 상태를 변경하거나 필터링하는 토글 버튼 | Filter Chips, Period Toggles, Asset Tabs |
| **Icon Button** | **`rounded-full`** | 텍스트 없이 아이콘만 있는 원형 버튼 | Close(X), Delete(Trash), Menu |
| **Small Trigger** | **`rounded-2xl`** | 리스트 내부의 작은 액션 트리거 | Edit(Pencil), Add Funds(Small) |

### C. 사이즈 및 계층 (Size & Hierarchy)

*   **Primary**: `bg-slate-900` (검정) - 화면당 1~2개 주요 액션.
*   **Secondary**: `bg-emerald-50 text-emerald-600` 등 - 긍정적 보조 액션.
*   **Destructive**: `bg-rose-50 text-rose-600` - 삭제, 취소 등 부정적 액션.
*   **Outline/Ghost**: 배경 없는 보조 버튼.

---

## 3. 리팩토링 계획 (Refactoring Plan)

다음 순서로 모든 버튼을 교체합니다.

1.  **[UI] Button 컴포넌트 업그레이드**: `rounded-2xl` 기본값 확정 및 `icon` 사이즈(`rounded-full`) 명시.
2.  **[Feature] 탭/필터 교체**: `Dashboard.tsx`, `FilterBar.tsx`의 `<button>`을 `<Button shape="pill">` 또는 커스텀 컴포넌트(TabButton)로 교체.
3.  **[Feature] 모달 버튼 교체**: `Dashboard.tsx` (Budget Modal), `AssetManager.tsx` 등의 Save/Cancel 버튼을 `<Button>`으로 통일.
4.  **[Cleanup] 잔여 태그 제거**: `grep`으로 `<button>`이 남지 않도록 전수 수정.
