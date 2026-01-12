# 레이아웃 정책 계획서 (Layout Policy Plan)

이 문서는 "Trustworthy, Modern & Clean" 디자인 철학을 구체적인 공간 배치와 구조로 구현하기 위한 레이아웃 가이드라인입니다. 홈 화면부터 최소 단위 컴포넌트까지 일관된 사용자 경험을 제공하는 것을 목표로 합니다.

## 1. 레이아웃 철학 (Layout Philosophy)

*   **여백의 미 (Breathable)**: 콘텐츠 간 충분한 간격을 두어 정보의 밀집도를 낮추고 가독성을 높입니다.
*   **반응형 (Responsive)**: 모바일(Touch-first)과 데스크톱(Mouse/Keyboard) 환경 모두에서 최적화된 경험을 제공합니다.
*   **계층 구조 (Hierarchy)**: 중요도에 따라 크기, 위치, 깊이(Depth)를 조절하여 시선의 흐름을 유도합니다.

---

## 2. 글로벌 구조 (Global Structure)

### 2.1 앱 셸 (App Shell)
애플리케이션의 기본 골격입니다.

| 영역 | 데스크톱 (lg 이상) | 모바일 (lg 미만) |
| :--- | :--- | :--- |
| **Navigation** | **Left Sidebar** (고정, 아이콘+라벨) | **Sticky Bottom Bar** 또는 **Hamburger Menu** (공간 절약) |
| **Main Content** | 중앙 배치, `max-width: 1200px` | 전체 너비 (`w-full`), 좌우 패딩 `16px` |
| **Header** | 콘텐츠 영역 상단 (타이틀/액션) | 상단 고정 (Sticky), 스크롤 시 축소/블러 처리 |

### 2.2 그리드 시스템 (Grid System)
Tailwind CSS의 기본 Grid를 활용하되, 의미론적 단위를 정의합니다.

*   **Dashboard Grid**:
    *   Desktop: 3~4 컬럼 (유연한 위젯 배치)
    *   Tablet: 2 컬럼
    *   Mobile: 1 컬럼 (수직 스택)
*   **Gutter (간격)**: `gap-4` (16px)를 기본으로 하고, 섹션 간 분리는 `gap-8` (32px) 사용.

---

## 3. 페이지 레벨 레이아웃 (Page Layouts)

### 3.1 홈 / 대시보드 (Home / Dashboard)
*   **위젯 기반 (Widget-based)**: 각 정보(자산 요약, 최근 내역, 예산)를 독립된 `Card` 위젯으로 구성합니다.
*   **Z-Pattern / F-Pattern**: 가장 중요한 '총 자산'이나 '이번 달 지출'을 좌상단/상단에 배치합니다.
*   **섹션 구분**: 배경색(`bg-surface`)과 위젯(`bg-white`)의 대비를 통해 자연스럽게 구획을 나눕니다.

### 3.2 리스트 뷰 (List View - Transaction/Asset)
*   **카드형 리스트**: 각 항목을 물리적으로 분리된 `Card`로 표현하여 명확성을 높입니다. (현재 적용됨)
*   **Sticky Header**: 날짜나 그룹 헤더를 스크롤 시 상단에 고정하여 컨텍스트를 유지합니다. (`backdrop-blur` 적용)
*   **Action Area**:
    *   Desktop: 리스트 상단 우측에 필터/정렬 배치.
    *   Mobile: 리스트 상단에 가로 스크롤 칩(Chip) 형태나 하단 Floating Action Button(FAB) 고려.

### 3.3 입력 폼 (Form Layouts)
*   **One Column Vertical Check**: 모바일 입력을 고려하여 수직 배치를 기본으로 합니다.
*   **Grouped Fields**: 관련 있는 필드(예: 금액/날짜, 카테고리/태그)는 그룹핑하여 `Card` 안에 담습니다.
*   **Label Placement**: 필드 상단(Top-aligned)에 라벨을 배치하여 시선 이동을 최소화합니다.

---

## 4. 컴포넌트 레벨 레이아웃 (Component Patterns)

### 4.1 카드 (Card)
모든 정보의 기본 컨테이너입니다.
*   **Padding**:
    *   기본: `p-5` or `p-6` (여유로움)
    *   컴팩트: `p-3` or `p-4` (밀집 정보)
*   **Header/Body/Footer**: 명확한 구분이 필요한 경우 내부적으로 영역을 나눕니다.

### 4.2 모달 (Modal / Dialog)
*   **Desktop**: 화면 중앙 정렬, 최대 너비 제한(`max-w-md`), 뒷배경 딤(Dim) 처리.
*   **Mobile**: 화면 하단에서 올라오는 **Bottom Sheet** 형태 권장 (엄지손가락 접근성 위함).

### 4.3 버튼 배치 (Button Layout)
*   **Primary Action**: 우측 하단 (데스크톱) 또는 하단 전체 너비 (모바일, `w-full`).
*   **계층**: 주요 버튼(Primary)은 채워진 스타일, 보조 버튼(Cancel)은 텍스트/고스트 스타일.

---

## 5. 마이크로 레이아웃 (Spacing & Alignment)

### 5.1 스페이싱 스케일 (Spacing Scale)
8pt 그리드 시스템을 기반으로 Tailwind 스케일을 엄격하게 적용합니다.
*   **xs** (`gap-1`, 4px): 매우 밀접한 요소 (아이콘과 텍스트)
*   **sm** (`gap-2`, 8px): 관련된 요소 (버튼 그룹)
*   **md** (`gap-4`, 16px): 폼 필드 간격, 리스트 아이템 간격
*   **lg** (`gap-6`, 24px): 카드 내부 섹션 구분
*   **xl** (`gap-8`, 32px): 페이지 내 큰 섹션 구분

### 5.2 정렬 (Alignment)
*   **텍스트**: 왼쪽 정렬(Left Align)을 기본으로 합니다. (숫자 데이터는 우측 정렬 권장, 단 테이블 내에서는 헤더와 맞춤)
*   **수직 중앙 정렬**: 아이콘과 텍스트가 함께 있을 땐 항상 `items-center`를 사용합니다.

---

## 6. 실행 계획 (Action Plan)

1.  **App Shell 개선**: `App.tsx`의 레이아웃 구조를 검토하고 데스크톱/모바일 분기 처리를 명확히 합니다 (특히 모바일 내비게이션).
2.  **Dashboard 재구성**: 위젯 그리드 시스템을 적용하여 반응형 동작을 개선합니다.
3.  **Modal 컴포넌트 고도화**: 모바일 환경에서 Bottom Sheet 스타일을 지원하도록 `Dialog` 컴포넌트를 개선합니다.
4.  **Form 표준화**: 모든 입력 폼을 `Vertical Stack + Card Grouping` 패턴으로 리팩토링합니다.
