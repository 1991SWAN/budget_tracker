# 모달 시스템(Modal System) 디자인 정책 및 개선 보고서

## 1. 현황 진단 (Cold Feedback)
현재 `Dialog.tsx`는 "데스크탑 모달을 억지로 모바일 화면 하단에 붙인" 형태입니다.
**문제점:**
1.  **UX 불일치**: 모바일 사용자는 카드를 아래로 **스와이프해서 닫는(Drag-to-dismiss)** 제스처에 익숙하지만, 현재는 불가능합니다. (오직 X 버튼이나 배경 터치만 가능)
2.  **버튼 배치**: 데스크탑은 우측 정렬(Cancel/Save)이 표준이지만, 모바일은 **하단 꽉 찬 버튼(Full-width Stacked)**이 표준입니다. 현재 코드는 이 차이를 무시하고 있습니다.
3.  **애니메이션**: 단순한 Slide-up은 부자연스럽습니다. iOS 스타일의 탄성 있는(Spring) 애니메이션이 필요합니다.

## 2. 모달 디자인 정책 (Design Policy)

### A. 핵심 철학: "맥락에 맞는 적응형(Adaptive Context)"
- **Mobile**: 사용자의 손가락 범위 내에서 해결하는 **Sheet (Bottom Drawer)**.
- **Desktop**: 정보의 집중도를 높이는 **Center Dialog**.

### B. 상세 비주얼 가이드라인

#### 1. 모바일 (Mobile Bottom Sheet)
*   **Shape**: 상단 모서리 `Rounded-t-3xl` (24px 이상).
*   **Height**: 최대 높이 `85vh` 제한 (상단 여백 확보 필수).
*   **Handle**: 상단 중앙에 회색 바(Handle bar) 필수 + **Drag to Dismiss(스와이프 닫기)** 기능 구현.
*   **Density**: 좁은 화면을 고려하여 `Gap`과 `Font Size`를 축소 (예: `text-3xl`, `gap-2`).
*   **Footer**: **Stacked Reverse (Primary Top)**.
    *   [ 저장 (Primary) ] (상단)
    *   [ 취소 (Ghost)   ] (하단)

#### 2. 데스크탑 (Desktop Modal)
*   **Shape**: 전체 모서리 `Rounded-2xl` (16px~20px).
*   **Effect**: 은은한 그림자 (`shadow-2xl`) + 테두리 (`border-white/20`).
*   **Header**: **제거 (Headless)**. 컨텐츠 몰입감을 위해 상단 바를 제거합니다.
*   **Closing**:
    *   **Main**: Footer의 [Cancel] / [Close] 버튼 사용.
    *   **Optional**: 필요 시 컨텐츠 내부에 자체 'X' 버튼 배치 (우측 상단).
*   **Footer**: **Right-aligned**.
    *   [취소] [저장] (수평 배치)

## 3. 최신 모바일 트렌드 반영 (Trend Enhancements)

### A. "Clean & Gesture-First"
*   **No Top X Button**: 상단 'X' 버튼은 시각적 소음(Visual Noise)으로 간주하여 **전면 제거**합니다.
*   **Closing**: 
    - **Primary**: Footer의 [Cancel] 버튼.
    - **Gesture**: 배경 터치(Backdrop Click) 또는 아래로 스와이프(Swing Down).
    - **Haptics**: 닫기/저장 시 미세한 햅틱 피드백(Impact Light) 제공 권장.

### B. "Dynamic Detents" (Sheet)
*   컨텐츠 양에 따라 높이가 유동적으로 변하는 **Adaptive Height**를 지향합니다.
*   불필요한 공백을 줄이고, 사용자가 컨텐츠에 집중하도록 합니다.

## 4. 기술 구현 전략 (Technical Plan)

기존 `Dialog.tsx`를 폐기하고, **Headless UI** 패턴을 도입하여 구조를 분리합니다.

```tsx
// ResponsiveModal.tsx (Wrapper)
return isDesktop ? <DesktopDialog /> : <MobileSheet />;
```

*   **MobileSheet**: `Framer Motion` 또는 `Vaul`(Drawer 라이브러리) 도입 고려. (제스처 처리를 위해 라이브러리 사용 권장)
*   **Props 표준화**:
    *   `title` (Optional - 헤더 없이 컨텐츠만 표시 가능)
    *   `primaryAction` (label, onClick)
    *   `secondaryAction` (label, onClick)
    *   `children` (Body content)

## 4. 결론 및 승인 요청
단순히 CSS만 고치는 것이 아니라, **"모바일은 시트, 데스크탑은 다이얼로그"**라는 이원화 전략으로 코드를 리팩토링할 것을 제안합니다.

이 정책에 동의하신다면, 다음 단계로 **공통 컴포넌트(`ResponsiveModal`)** 개발을 시작하겠습니다.
