# 디자인 일관성 감사 보고서 (Design Consistency Audit Report)

## 1. 개요 (Overview)
본 보고서는 `SmartPenny` 프로젝트의 현재 코드베이스가 사전에 정의된 **디자인 시스템** 및 **모달 정책**을 얼마나 준수하고 있는지 점검한 결과입니다.
최근 추가된 `CSV Import` 기능을 중심으로, 디자인 파편화(Fragmentation) 현상을 분석했습니다.

## 2. 주요 발견 사항 (Key Findings)

### 🚨 심각한 위반 (Critical Violations)

#### A. 버튼 컬러 불일치 (Color Mismatch)
*   **정책 (Standard)**: Primary Color는 `Slate 900 (#0f172a)`이어야 하며, `Blue`, `Indigo` 등 원색 사용을 지양합니다.
*   **위반 (Violation)**: `ImportWizardModal.tsx`에서 파일 선택 및 최종 저장 버튼에 `bg-blue-600`이 하드코딩되어 있습니다.
    *   `bg-blue-600` → `bg-slate-900` (또는 `bg-primary`)로 수정 필요.

#### B. 모달 구조 위반 (Modal Structure)
*   **정책 (Standard)**: 데스크탑 모달은 **Headless (헤더 없음)** 정책을 따르며, 상단 'X' 버튼 대신 하단 [Cancel] 버튼을 권장합니다.
*   **위반 (Violation)**: `ImportWizardModal`에 명시적인 헤더(`border-b`)와 우측 상단 'X' 버튼이 존재합니다. 이는 기존의 다른 모달(새로운 정책 적용된)과 이질감을 줍니다.

#### C. 딤드 처리 (Backdrop Dimming)
*   **정책 (Standard)**: `bg-black/40 backdrop-blur-sm`
*   **위반 (Violation)**: `ImportWizardModal`에서 `bg-black/50`을 사용하고 있어 약간 더 어둡습니다.

---

### ⚠️ 개선 필요 사항 (Improvements Needed)

#### A. 타이포그래피 토큰 미사용
*   `ImportWizardModal` 내부 텍스트가 `text-slate-900`, `text-slate-500` 등으로 하드코딩되어 있습니다.
*   `tailwind.config.js`에 정의된 `text-primary`, `text-muted` 등의 시맨틱 토큰을 사용하는 것이 유지보수에 유리합니다.

#### B. 버튼 쉐이프 (Button Shape)
*   일부 버튼이 `rounded-lg` (8px)로 설정되어 있습니다.
*   디자인 시스템의 **Action Button** 표준은 `rounded-2xl`입니다.

---

## 3. 리팩토링 제안 (Refactoring Plan)

### 1단계: 마법사(Wizard) 모달 디자인 수정
`ImportWizardModal.tsx`를 디자인 시스템에 맞게 전면 수정합니다.

1.  **헤더 제거**: 상단 타이틀 바를 제거하고, 타이틀을 본문 영역 상단(`H2`)으로 이동.
2.  **컬러 통일**: `blue-600` -> `slate-900` 교체.
3.  **버튼 스타일**: `rounded-2xl` 적용 및 하단 Footer 레이아웃 표준화.

### 2단계: 공통 컴포넌트 활용
향후 유사한 위반을 방지하기 위해 `Button.tsx`와 같은 공통 컴포넌트 사용을 강제해야 합니다. 현재 마법사 모달은 HTML `<button>`을 직접 스타일링하고 있어 규칙이 깨지기 쉽습니다.

## 4. 결론
기능 구현은 훌륭하나, 사용자 경험의 일관성을 위해 **디자인 리팩토링**이 필수적입니다. 위 제안된 수정 사항을 즉시 반영할 것을 권장합니다.
