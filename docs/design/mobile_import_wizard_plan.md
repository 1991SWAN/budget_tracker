# CSV 가져오기 마법사 모바일 최적화 계획 (Mobile Import Wizard Optimization Plan)

## 1. 현황 및 문제점 (Current Status & Issues)
현재 `ImportWizardModal`은 데스크탑 환경(`max-w-2xl`)을 기준으로 설계되어 있어, 모바일 화면(폭 375px~430px)에서 다음과 같은 심각한 UI 깨짐이 발생합니다.

### 🚨 주요 문제 (Critical Issues)
1.  **매핑 그리드 깨짐**: `grid grid-cols-3` 레이아웃이 좁은 화면에서도 유지되어, 드롭다운(Select)이 찌그러지거나 텍스트가 겹칩니다.
2.  **테이블 오버플로우**: 데이터 미리보기 테이블이 화면 너비를 초과하지만, 적절한 가로 스크롤(Scroll Hint)이 없거나 레이아웃을 망가뜨립니다.
3.  **버튼 공간 부족**: 하단 Action 버튼들이 가로(`flex-row`)로 배치되어 있어, 버튼 텍스트가 줄바꿈되거나 영역을 벗어납니다.
4.  **과도한 여백**: 데스크탑용 패딩(`p-8`)이 모바일에서는 너무 넓어 실제 콘텐츠 영역을 잡아먹습니다.

---

## 2. 개선 방향 (Improvement Strategy)

### A. 반응형 레이아웃 (Responsive Layout)
Tailwind의 Breakpoint(`sm`, `md`)를 적극 활용하여 데스크탑과 모바일의 레이아웃을 이원화합니다.

| 영역 | 데스크탑 (Desktop, `md` 이상) | 모바일 (Mobile, 기본) |
| :--- | :--- | :--- |
| **모달 형태** | 중앙 정렬 카드 (Center Dialog) | **하단 시트 (Bottom Sheet) 또는 전체 화면** |
| **컬럼 매핑** | `grid-cols-3` (가로 3열) | **`grid-cols-1` (세로 1열 스택)** |
| **버튼 배치** | 양측 정렬 (Between) | **세로 스택 (Column Reverse)** |
| **내부 여백** | `p-8` | **`p-4`** |

### B. 터치 친화적 인터페이스 (Touch-Friendly UI)
*   **가로 스크롤**: 테이블(`table`) 영역에 명시적인 `overflow-x-auto`를 적용하고, 스크롤 가능함을 시각적으로 암시합니다.
*   **입력 터치 영역**: 모바일에서 드롭다운(`select`)과 버튼의 높이를 충분히 확보(`min-h-[44px]`)합니다.

---

## 3. 상세 구현 계획 (Implementation Details)

### 1단계: 컨테이너 및 헤더 수정
*   **패딩 축소**: `p-8` -> `p-4 sm:p-8`
*   **라운드 조정**: 모바일에서는 하단이 꽉 차는 형태 고려 (`rounded-b-none sm:rounded-[32px]`).

### 2단계: 매핑 화면(Step 2) 반응형 처리
*   **그리드 수정**:
    ```tsx
    // Before
    <div className="grid grid-cols-3 gap-4">
    
    // After
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    ```
    모바일에서는 날짜/내용/금액 선택기가 세로로 쌓이게 하여 조작성을 높입니다.

### 3단계: 테이블 뷰 개선
*   **가로 스크롤 컨테이너**:
    ```tsx
    <div className="border ... overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <table className="min-w-full">...</table>
    </div>
    ```
    모바일에서 테이블이 화면 밖으로 자연스럽게 스크롤되도록 하고, 좌우 엣지 여백을 조정합니다.

### 4단계: 버튼 액션바 재구성
*   **데스크탑**: [ Cancel ] ... [ Back ] [ Confirm ]
*   **모바일**: 버튼을 세로로 쌓되, 가장 중요한 'Confirm'이 손가락에 닿기 쉬운 위치에 오도록 배치합니다.

---

## 4. 기대 효과 (Expected Outcome)
*   **사용성**: 아이폰 SE 같은 작은 화면에서도 스크롤 없이 매핑 설정을 편안하게 할 수 있습니다.
*   **완성도**: "작동은 하는데 모양이 깨지는" 느낌을 완전히 제거하여 프로덕션 레벨의 퀄리티를 확보합니다.
