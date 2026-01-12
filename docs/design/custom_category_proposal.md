# 커스텀 카테고리 기능 구현 제안서

## 1. 현황 분석
현재 SmartPenny의 카테고리는 `types.ts` 내에 **Enum(열거형 상수)**으로 고정되어 있습니다.
```typescript
export enum Category {
  FOOD = 'Food & Dining',
  TRANSPORT = 'Transportation',
  ...
}
```
*   **문제점**: 코드로 고정되어 있어 사용자가 추가/수정/삭제할 수 없습니다.
*   **목표**: 시스템의 디자인 일관성을 해치지 않으면서, 사용자가 자유롭게 카테고리를 관리할 수 있도록 변경합니다.

## 2. 기술적 변경 전략 (Data Structure)
Enum 방식을 폐기하고, **동적 객체 배열(Dynamic Object Array)** 방식으로 전환해야 합니다.

### 데이터 구조 (Interface)
```typescript
interface CategoryItem {
  id: string;          // 고유 ID (UUID)
  name: string;        // 표시 이름 (예: "배달음식")
  emoji: string;       // 아이콘 (예: "🍕")
  color: string;       // 테마 색상 (Design System 내 지정 색상)
  isDefault: boolean;  // 시스템 기본 제공 여부 (삭제 불가용)
}
```

## 3. 디자인 정책 준수 가이드 (Design System Compliance)
사용자가 임의로 색상을 고르게 하면 앱의 전체적인 톤앤매너(Tone & Manner)가 망가질 수 있습니다. 이를 방지하기 위해 **제한적 선택권**을 제공해야 합니다.

### (1) 색상 팔레트 제한 (Curated Color Palette)
사용자가 HEX 코드를 직접 입력하는 대신, 시스템이 제공하는 **프리미엄 컬러 셋** 중에서만 선택하게 합니다.
*   Slate (기본), Emerald (수입), Rose (지출), Blue (이체), Amber/Orange, Violet, Pink, Cyan
*   *이유: 너무 쨍하거나(Neon) 안 보이는 색상 선택 방지*

### (2) 이모지 사용 권장
텍스트만 있는 것보다 이모지를 적극 활용하는 현재 디자인을 유지하기 위해, 카테고리 생성 시 **이모지 선택을 필수(또는 기본값 자동 할당)**로 합니다.

## 4. 구현 로드맵
1.  **데이터베이스/스토리지**: `categories` 테이블 생성 (Supabase) 및 초기 데이터 마이그레이션.
2.  **설정 화면(UI)**: '카테고리 관리' 페이지 신설.
    *   리스트 뷰: 순서 변경(Drag & Drop), 수정, 삭제.
    *   추가/수정 모달: 이름 입력, 이모지 피커, 컬러 팔레트 선택.
3.  **적용**: 트랜잭션 입력 및 필터 바에서 Enum 대신 동적 리스트를 불러오도록 수정.

## 5. 결론
이 방식을 도입하면 **"사용자의 자유도"**와 **"시스템의 디자인 통일성"**을 동시에 잡을 수 있습니다. 승인해주시면 데이터 구조 설계부터 시작하겠습니다.
