# 버튼 형태 일관성 분석 및 개선안 (Button Shape Consistency)

**작성일**: 2026-01-10
**목적**: 앱 전반의 버튼 형태(Border Radius) 불일치를 해결하고 통일된 디자인 언어를 정립함.

## 1. 현황 분석 (Current State)
사용자 지적대로, 현재 버튼의 둥근 정도(Radius)가 기능과 상관없이 제각각입니다.

| 컴포넌트 | 현재 형태 | 문제점 |
| :--- | :--- | :--- |
| **기본 버튼 (Button.tsx)** | `rounded-2xl` | 기준이 되는 형태이나, 다른 곳에서 지켜지지 않음. |
| **Add Asset (Button)** | `rounded-full` | 캡슐 형태. 일반 버튼(`rounded-2xl`)과 이질감 발생. |
| **Filter / Tabs** | `rounded-full` | 칩(Chip) 형태로는 적절하나, 버튼과 혼용되어 보임. |
| **Add Bill / Add Funds** | `rounded-full` / `rounded-lg` | 같은 "추가" 기능인데 모양이 다름. |
| **Calendar Item** | `rounded-2xl` | 카드/버튼 중간 형태. |

## 2. 디자인 원칙 수립 (Shape Policy)
토스(Toss), 카카오 등 모던 핀테크 앱의 트렌드를 반영하여 다음과 같이 형태를 정의합니다.

### A. Action Buttons (실행 버튼) -> `rounded-2xl`
*   사용자의 주요 행동(저장, 추가, 확인 등)을 유도하는 버튼.
*   **Target**: `Add Bill`, `Add Asset`(Desktop), `Add Goal`, `Save`, `Cancel`
*   **Rationale**: `rounded-full`보다 단단하고 안정적인 느낌을 주며, `rounded-xl`보다 더 친근함(Soft).

### B. Chips & Tabs (선택/필터) -> `rounded-full`
*   상태를 토글하거나 필터링하는 요소.
*   **Target**: `FilterBar` (All/Expense/Income...), `Asset Tabs`, `Period Toggles` (Today/Week/Month).
*   **Rationale**: 완전히 둥근 캡슐 형태는 "선택 가능한 옵션"이라는 인식을 줌.

### C. Containers & Cards (컨테이너) -> `rounded-3xl`
*   정보를 담는 큰 그릇.
*   **Target**: `AssetCard`, `Dashboard Sections`, `Modals`.

### D. Inner Elements (내부 요소) -> `rounded-xl`
*   카드 내부의 작은 아이콘 박스, 입력창(Input) 등.
*   **Target**: `Icon Box`, `Input Fields`.

---

## 3. 실행 계획 (Execution Plan)

1.  **BillManager / GoalManager 수정**:
    *   "Add Bill", "Add Funds" 버튼을 모두 **`rounded-2xl`**로 변경.
2.  **AssetManager 수정**:
    *   "Add Asset" 버튼을 **`rounded-2xl`**로 변경하여 다른 "Add" 버튼과 통일감을 줌.
3.  **Button.tsx 확인**:
    *   기본값이 `rounded-2xl`인지 재확인 (확인 완료).

이 규정에 따라 즉시 코드를 수정하겠습니다.
