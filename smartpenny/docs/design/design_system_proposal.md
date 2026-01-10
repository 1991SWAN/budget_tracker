# 디자인 시스템 제안 (Design System Proposal)

## 1. 디자인 철학 (Design Philosophy)
현재 앱의 디자인이 "중구난방"이라 느껴지는 이유는 **일관된 규칙의 부재** 때문입니다. 
다음 3가지 키워드를 중심으로 비주얼 아이덴티티를 재정립합니다.

1.  **Trustworthy (신뢰감)**: 금융 앱인 만큼 가볍지 않고 안정적인 느낌을 줍니다. 과도한 그라데이션을 줄이고 명확한 대비를 사용합니다.
2.  **Modern & Clean (현대적 & 깔끔함)**: 불필요한 장식을 배제하고, 여백(Spacing)을 충분히 활용하여 콘텐츠(숫자)에 집중하게 합니다.
3.  **Soft & Friendly (부드러움)**: 딱딱한 표 형태를 지양하고, 카드형 UI와 둥근 모서리(Rounded Corners)를 사용하여 모바일 친화적인 경험을 제공합니다.

---

## 2. 컬러 시스템 (Color System)
Tailwind의 기본 컬러를 사용하되, **Semantic(의미론적) 이름**으로 정의하여 사용합니다.

| 분류 | 역할 | 색상 코드 (Tailwind) | 의미 |
| :--- | :--- | :--- | :--- |
| **Primary** | 브랜드/강조 | `Slate 900` (#0f172a) | 신뢰, 메인 액션, 헤드라인 |
| **Secondary** | 보조/성장 | `Emerald 500` (#10b981) | 긍정, 수익, 완료 |
| **Destructive** | 경고/지출 | `Rose 500` (#f43f5e) | 부정, 지출, 삭제 |
| **Surface** | 배경 | `Slate 50` (#f8fafc) | 앱 배경 |
| **Surface** | 카드 배경 | `White` (#ffffff) | 콘텐츠 카드 |
| **Text** | 본문 | `Slate 600` (#475569) | 설명 텍스트 |
| **Text** | 보조 | `Slate 400` (#94a3b8) | 캡션, 비활성 |

> **개선점**: 기존에 혼재되어 사용되던 `Blue`, `Indigo`, `Violet` 등을 제거하고, 브랜드 컬러를 **Slate(Navy) + Emerald + Rose** 로 통일합니다. (자산별 테마 컬러 제외)

---

## 3. 타이포그래피 (Typography)
폰트는 **Inter**를 유지하되, 크기와 굵기 규칙을 단순화합니다.

*   **Display (가격/총액)**: `text-3xl` ~ `text-4xl` / `font-black`
*   **H1 (페이지 타이틀)**: `text-xl` / `font-bold`
*   **H2 (섹션 타이틀)**: `text-lg` / `font-bold`
*   **Body (본문/리스트)**: `text-sm` (14px) / `font-medium`
*   **Caption (보조정보)**: `text-xs` (12px) / `font-medium`
*   **Tag/Badge**: `text-[10px]` / `font-bold` / `uppercase`

---

## 4. UI 컴포넌트 표준 (UI Components)

### A. 카드 (Cards)
*   **Radius**: `rounded-3xl` (24px) - 부드러운 느낌 강조
*   **Shadow**: `shadow-sm` (기본) -> `shadow-md` (강조)
*   **Border**: `border border-slate-100` (아주 연한 경계선)

### B. 버튼 (Buttons)
*   **Primary**: `bg-slate-900 text-white` / `rounded-2xl` / `py-3` (높이 확보)
*   **Secondary**: `bg-white text-slate-700 border border-slate-200`
*   **Ghost**: `text-slate-500 hover:bg-slate-50`

### C. 입력 폼 (Inputs)
*   **Style**: `bg-slate-50` (배경색 있음) / `rounded-xl` / `border-transparent` -> Focus시 `ring-2 ring-slate-900`
*   **Label**: 입력 필드 상단에 작게 배치 (`text-xs font-bold text-slate-500 uppercase`)

### D. 모달 (Modals)
*   **Dimming**: `bg-black/40 backdrop-blur-sm` (과하지 않은 블러)
*   **Container**: `rounded-t-3xl` (모바일 시트 느낌) 또는 `rounded-3xl` (데스크탑)

---

## 5. 실행 계획 (Action Plan)

1.  **Tailwind 설정 확장**: `tailwind.config.js`에 커스텀 컬러/폰트 설정 추가.
2.  **공통 컴포넌트 제작**: `Button`, `Card`, `Badge` 컴포넌트를 만들어 재사용 (현재 하드코딩된 스타일 제거).
3.  **점진적 적용**:
    *   1순위: `App.tsx` (전체 레이아웃/모달 배경)
    *   2순위: `AssetManager` (자산 카드 통일)
    *   3순위: `TransactionList` (리스트 아이템 통일)
