# 디자인 시스템 v2.0 (Design System v2.0)

## 1. 디자인 철학 (Design Philosophy)
SmartPenny의 비주얼 아이덴티티는 **"Premium & Intuitive (프리미엄 & 직관성)"**을 지향합니다.
단순히 "예쁜 디자인"을 넘어, **형태(Shape)**와 **위계(Hierarchy)**를 통해 사용자의 행동을 자연스럽게 유도하는 것이 목표입니다.

*   **Premium**: 절제된 컬러, 깊이감 있는 그림자(Shadow), 미세한 인터랙션(Micro-interactions).
*   **Intuitive**: 기능에 따른 명확한 형태 구분 (Zone & Shape Language).
*   **Soft & Friendly**: 딱딱한 표 대신 둥근 카드와 위젯 중심의 레이아웃.

---

## 2. 컬러 시스템 (Color System)
**Semantic(의미론적) 이름**으로 색상을 정의하여 일관성을 유지합니다.

| 분류 | 역할 | 색상 코드 (Tailwind) | 의미 |
| :--- | :--- | :--- | :--- |
| **Primary** | 브랜드/강조 | `Slate 900` (#0f172a) | 신뢰, 메인 액션, 헤드라인 |
| **Secondary** | 보조/성장 | `Emerald 500` (#10b981) | 긍정, 수익, 완료 |
| **Destructive** | 경고/지출 | `Rose 500` (#f43f5e) | 부정, 지출, 삭제 |
| **Surface** | 배경 | `Slate 50` (#f8fafc) | 앱 배경 |
| **Surface** | 카드 배경 | `White` (#ffffff) | 콘텐츠 카드 |
| **Text** | 본문 | `Slate 600` (#475569) | 설명 텍스트 |
| **Text** | 보조 | `Slate 400` (#94a3b8) | 캡션, 비활성 |

---

## 3. 타이포그래피 (Typography)
폰트는 **Inter**를 사용하며, 숫자의 가독성을 위해 금액 표기 시 `Tabular Nums` 속성을 권장합니다.
*   **Display**: `text-3xl` ~ `text-4xl` / `font-black`
*   **H1**: `text-xl` / `font-bold`
*   **H2**: `text-lg` / `font-bold`
*   **Body**: `text-sm` (14px) / `font-medium`
*   **Caption**: `text-xs` (12px) / `font-medium`

---

## 4. 형태 및 위계 가이드라인 (Shape & Hierarchy Guidelines)

이 시스템의 핵심은 **"기능이 형태를 결정한다(Form follows Function)"**입니다.

### A. 버튼 (Buttons)
버튼의 모양만 보고도 그 역할을 짐작할 수 있어야 합니다.

| 역할 (Role) | 형태 (Shape) | 예시 (Example) | 설명 |
| :--- | :--- | :--- | :--- |
| **Primary Action** | **`Rounded-full` (타원형)** | `Quick Add`, `Save`, `Confirm` | 데이터를 생성하거나 확정하는 가장 중요한 행동. |
| **Navigation** | **`Rounded-xl` (부드러운 사각형)** | `Dashboard`, `Assets`, `Settings` | 페이지를 이동하는 메뉴. 리스트 형태에 적합. |
| **Status / Filter** | **`Rounded-full` (알약형)** | `Today/Week`, `Category Badge` | 상태를 표시하거나 필터링하는 요소. |
| **Inner Action** | **`Rounded-lg` (작은 사각형)** | `Edit`, `Delete` (카드 내부) | 컨텐츠 내부의 보조적인 액션. |

### B. 사이드바 (Sidebar Structure)
사이드바는 단순한 목록이 아니라, 역할에 따라 **Zone**이 분리되어야 합니다.

1.  **Navigation Zone (Top)**: 페이지 이동 메뉴. 좌측 정렬된 `Ghost` 버튼.
2.  **Action Zone (Middle)**: 데이터 생성(`Import`, `Add`). 중앙 정렬된 `Filled` 또는 `Outline` 버튼.
3.  **Admin Zone (Bottom)**: 사용자 프로필 및 로그아웃. 하단 고정 및 배경색 분리.

### C. 카드 및 위젯 (Cards & Widgets)
*   **Radius**: `Rounded-3xl` (24px)로 통일하여 부드러운 느낌 강조.
*   **Shadow**: 기본 `shadow-sm`, 호버 시 `shadow-md`로 깊이감 표현.
*   **Layout**: **Bento Grid** 시스템을 지향하여, 다양한 크기의 위젯이 조화롭게 배치되도록 함.

---

## 5. 인터랙션 및 모션 (Interaction & Motion)
정적인 UI에 생동감을 불어넣는 물리적 피드백 규정입니다.

*   **Hover**: 단순 색상 변경을 넘어, `Scale-105` (5% 확대) 및 `Shadow` 증가.
*   **Active (Click)**: `Scale-95` (5% 축소) 효과로 "눌리는" 느낌 제공.
*   **Transition**: 모든 변화는 `duration-200` ~ `duration-300`의 부드러운 속도 유지.

---

## 6. 모달 정책 (Modal Policy)
**"Adaptive Context"**: 디바이스 환경에 따라 최적의 형태를 제공합니다.

*   **Mobile**: **Bottom Sheet** (Drag-to-dismiss 지원, Stacked Buttons).
*   **Desktop**: **Center Dialog** (Headless, Right-aligned Buttons).
*   **Common**: `bg-black/40 backdrop-blur-sm` Dimming 적용.
*   **Minimalism (Compactness)**: 모달은 최대한 컴팩트하게 구성합니다. 불필요한 설명이나 중복 필드를 배제하고, 가능한 한 단순한 토글이나 자동 로직을 사용하여 화면 공간을 효율적으로 활용합니다.

---

## 7. 적용 로드맵 (Roadmap)
1.  **v2.0 선포**: 본 문서를 디자인의 단일 진실 공급원(SSOT)으로 삼음.
2.  **Sidebar Refactor**: v2.0 위계 규칙 적용 완료.
3.  **Component Refactor**: `Button`, `Card` 컴포넌트에 v2.0 형태/인터랙션 규칙 강제 적용.
