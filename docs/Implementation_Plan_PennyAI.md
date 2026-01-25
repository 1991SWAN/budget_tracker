# Implementation Plan: Penny AI - Conversational Financial Analyst

사용자가 자신의 재무 데이터를 기반으로 AI와 대화하며 통찰을 얻을 수 있는 "Penny AI" 기능을 구현합니다.

## Goal
- 사용자가 "이번 달 커피에 얼마 썼어?", "지난달이랑 비교해서 지출이 늘었어?"와 같은 질문을 하면, 실제 DB 데이터를 분석하여 답변을 제공합니다.
- **데이터 직접 변경**: "방금 결제한 5천원짜리 커피 내역 삭제해줘", "어제 점심 먹은 거 식비가 아니라 교육비로 옮겨줘"와 같은 명령을 수행할 수 있습니다.
- **승인 후 실행 (Confirm-then-Act)**: AI가 제안한 변경 사항을 사용자가 최종적으로 '승인' 버튼을 눌렀을 때만 실제 DB에 반영합니다.

## Proposed Changes

### 1. AI 서비스 및 액션 엔진 (Service Layer)
#### [MODIFY] [geminiService.ts](file:///Users/apple/macWork/macCoding/vivecoding/01_antigravity/02_smartpenny/smartpenny/services/geminiService.ts)
- `processPennyRequest` 메서드로 진화:
    - **Intent 분석**: 질문이 '조회(Query)'인지 '변경(Action)'인지 구분합니다.
    - **Action Schema**: 변경 요청 시 `CREATE`, `UPDATE`, `DELETE` 명령과 관련 파라미터(id, amount, category 등)를 JSON 형태로 반환합니다.
- **Action Dispatcher**: AI가 제안한 명령을 받아 UI에 확인 카드를 띄우고, 승인 시 `transactionService` 등을 호출합니다.

### 2. UI 컴포넌트 개발 (UI Layer)
#### [NEW] [PennyChat.tsx](file:///Users/apple/macWork/macCoding/vivecoding/01_antigravity/02_smartpenny/smartpenny/components/ai/PennyChat.tsx)
- **Action Preview Card**: 채팅창 내부에 "이 트랜잭션을 삭제하시겠습니까?" 또는 "금액을 10,000원으로 수정할까요?"와 같은 확인 카드를 렌더링합니다.
- **Approval Flow**: '승인' 클릭 시 실제 DB 처리 후 성공 메시지 표시.

### 3. 메인 레이아웃 통합 (Integration)
#### [MODIFY] [App.tsx](file:///Users/apple/macWork/macCoding/vivecoding/01_antigravity/02_smartpenny/smartpenny/App.tsx)
- 상단 헤더 또는 메인 화면에 Penny AI 진입 버튼 추가.
- 전역 상태로 채팅창 열림/닫힘 관리.

## User Review Required

> [!IMPORTANT]
> **데이터 보안 및 범위**: AI 분석을 위해 사용자의 트랜잭션 데이터를 Gemini API로 전송하게 됩니다. (개인 식별 정보는 최소화하되, 금액과 가맹점 명칭은 포함됨)
> 
> **데이터 양 제한**: 너무 많은 트랜잭션(수천 개 이상)은 한 번의 프롬프트에 담기 어려울 수 있습니다. 초기 버전에서는 **최근 3개월 데이터** 또는 **상위 100~200개 내역**을 우선 제공하고, 필요시 추가 데이터를 조회하는 방식을 제안합니다.

## Verification Plan

### Automated Tests
- `geminiService.chatWithData` 유닛 테스트: 가상 데이터를 넣었을 때 정확한 합계를 말하는지 확인.

### Manual Verification
1. Penny AI 버튼 클릭 시 채팅 패널 노출 확인.
2. "식비에 얼마 썼어?" 질문 후 실제 지출 내역과 AI 답변 비교.
3. "지난달이랑 비교해줘" 질문 시 과거 데이터 분석 여부 확인.
