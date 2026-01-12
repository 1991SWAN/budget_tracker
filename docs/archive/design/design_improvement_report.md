# 디자인 개선 연구 보고서 (Design Improvement Report)

## 1. 개요 (Executive Summary)
현재 SmartPenny의 대시보드와 네비게이션 구조는 기능적으로는 완성되어 있으나, 시각적 **위계(Hierarchy)**와 **맥락(Context)**에 따른 형태적 일관성이 일부 부족합니다. 사용자 경험(UX)을 한 단계 높이기 위해 "프리미엄 & 직관성"을 목표로 하는 개선안을 제안합니다.

---

## 2. 주요 개선 필요 영역 (Key Areas for Improvement)

### A. 사이드바 (Sidebar Navigation)
**현황:**
- 메뉴와 액션 버튼(Import, Quick Add)이 혼재되어 시선의 흐름이 끊임.
- "Sign Out"과 같은 관리 기능이 네비게이션과 유사한 형태로 배치되어, 기능적 구분이 모호함.

**개선 제안:**
1.  **영역의 명확한 분리 (Zoning):**
    -   **Top (Navigation):** `Dashboard`, `Transactions`, `Assets`, `AI Analysis` 등 페이지 이동 목적의 메뉴는 **"Ghost 버튼 + 좌측 정렬"**로 통일하여 깔끔한 리스트 형태 유지.
    -   **Middle (Primary Actions):** `Quick Add`, `Import CSV` 등 데이터를 생성하는 액션은 **"Filled/Outline 버튼 + 중앙 정렬"** 또는 **"Floating Action Button (FAB)"** 스타일로 강조하여 네비게이션과 시각적으로 분리.
    -   **Bottom (User & System):** 사용자 프로필과 로그아웃은 하단에 고정하고, 배경색이나 구분선을 통해 별도의 '관리 영역'임을 명시.

2.  **형태적 차별화 (Shape Language):**
    -   페이지 이동 메뉴: `Rounded-lg` 또는 `Rounded-xl` (부드러운 사각형)
    -   주요 액션 버튼: `Rounded-full` (완전한 타원형) 또는 `Rounded-2xl` (더 둥근 사각형)을 사용하여 "누를 수 있는 버튼"임을 강조.

### B. 대시보드 위젯 (Dashboard Widgets)
**현황:**
- "Safe to Spend" 카드는 그라데이션을 사용하여 강조되지만, 주변의 흰색 카드들과 시각적 조화가 다소 떨어질 수 있음.
- "Net Worth", "Active Expenses" 등의 작은 카드들이 텍스트 위주로 되어 있어 직관적인 인지가 어려움.

**개선 제안:**
1.  **Bento Grid 그리드 시스템 도입:**
    -   다양한 크기의 위젯이 오밀조밀하게 맞물리는 Bento 레이아웃을 적용하여 시각적 재미와 정돈됨을 동시에 추구.
2.  **정보의 시각화 (Visualization):**
    -   단순 텍스트(`2,500,000`) 대신 **"미니 스파크라인(Sparkline)"** 차트나 **"프로그레스 바"**를 썸네일로 추가하여 데이터의 흐름을 한눈에 파악.
3.  **카드 스타일 통일:**
    -   모든 카드의 `Shadow`와 `Border-radius`를 통일 (`Rounded-3xl`, `Shadow-sm`).
    -   헤더 영역(아이콘 + 타이틀)의 패딩과 폰트 크기를 표준화.

### C. 타이포그래피 및 가독성 (Typography & Readability)
**현황:**
- 일부 요소(라벨, 보조 텍스트)의 폰트 사이즈나 색상이 제각각일 수 있음. ex) `text-slate-500` vs `text-muted` (Tailwind 클래스 혼용).

**개선 제안:**
1.  **텍스트 위계 재정립:**
    -   **Display:** 숫자 데이터 (가장 크게, Bold)
    -   **Headline:** 위젯 타이틀 (중간 크기, SemiBold, Slate-800)
    -   **Body:** 일반 정보 (Slate-600)
    -   **Caption:** 부가 설명 (Slate-400, Small)
2.  **숫자 가독성 강화:**
    -   금액 표시에는 `Tabular Nums` (등폭 숫자) 폰트 속성을 적용하여 숫자가 세로로 잘 정렬되도록 함.

### D. 인터랙션 (Micro-interactions)
**현황:**
- 버튼 호버 시 단순 색상 변경만 일어남.

**개선 제안:**
1.  **Scale & Lift:** 버튼이나 카드 호버 시 `Scale-105` 등의 미세한 확대 효과와 함께 그림자(`Shadow-md`)가 깊어지는 효과 추가.
2.  **Click Feedback:** 클릭 시 `Active:Scale-95` 효과를 주어 쫀득한 클릭감 제공.

---

## 3. 실행 계획 (Action Plan)

| 우선순위 | 영역 | 작업 내용 | 예상 난이도 |
| :--- | :--- | :--- | :--- |
| **즉시** | **Sidebar** | 네비게이션/액션/시스템 영역의 시각적 분리 및 버튼 형태 차별화 적용 | ⭐️ |
| **단기** | **Dashboard** | 위젯 헤더/폰트 스타일 통일 및 'Safe to Spend' 카드 디자인 고도화 | ⭐️⭐️ |
| **중기** | **Global** | 공통 컴포넌트(`Card`, `Button`)의 인터랙션(Hover/Active) 모션 표준화 | ⭐️⭐️ |
| **장기** | **Visual** | 아이콘 세트 교체 (Lucide React 등 일관된 라인 아이콘 사용) 및 Bento Grid 레이아웃 전면 개편 | ⭐️⭐️⭐️ |

이 보고서를 바탕으로 **사이드바 영역의 위계 분리**부터 즉시 적용하는 것을 권장합니다.
