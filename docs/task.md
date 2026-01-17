# 작업 목록 (Task List)

## 1. 핵심 인프라 & 자산 (Core Infrastructure & Assets)
앱의 기반이 되는 데이터 구조, 인증, 자산 관리 영역입니다.

- [x] **인증 시스템 (Authentication)**
    - [x] **Supabase Auth**: 이메일/패스워드 로그인 및 RLS 정책 적용.
    - [x] **Google 로그인**: OAuth 연동 및 모바일 호환성 확보.
    - [x] **보안 강화**: 단일 기기 접속(Single Device) 강제, 익명 로그인 로직 제거.
    - [x] **세션 관리**: 새로고침 시 데이터 유지 및 화이트 스크린 방지.

- [x] **보안 강화 및 감사 (Security Audit)**
    - [x] **RLS 정책 강화**: 익명 사용자(Anonymous) 접근 원천 차단 (`to_boolean` 체크).
    - [x] **함수 보안**: `search_path` 명시적 설정으로 SQL Injection 방지.
    - [x] **비밀번호 정책**: 유출된 비밀번호(Pwned Password) 차단 가이드 수립.

- [x] **자산 관리 (Asset Management)**
    - [x] **데이터 설계**: `institution`, `account_number` 등 상세 스키마 정의.
    - [x] **자산 UI**: 카드/통장 메타포 디자인, 유형별 동적 입력 폼.
    - [x] **그룹핑**: 자산 유형별(입출금, 적금, 대출 등) 탭 분리 및 시각화.
    - [x] **보기 옵션**: 정렬(잔액/이름순) 및 그룹화(은행/유형별) 기능 구현.
    - [x] **고급 로직**: 대출 상환, 이자 계산, 총자산 제외 옵션 구현.
    - [x] **초기화 로직 개선**: 내역 삭제 시 검증 후 잔액 0 처리 (Verify-then-Reset).

---

## 2. 거래 시스템 (Transaction System)
가계부의 핵심 엔진인 거래 입력, 조회, 수정, 삭제 로직입니다.

- [x] **거래 로직 (Transaction Logic)**
    - [x] **Hook Architecture**: `useTransactionManager` 도입으로 비즈니스 로직 중앙화.
    - [x] **데이터 무결성**: 거래 입력/삭제 시 자산 잔액 자동 연동(Atomic Operation).
    - [x] **할부 로직**: 월별 분할 계산(FinanceCalculator) 및 잔여 회차 표시.
    - [x] **안전 장치**: 삭제 시 자산 역산(Reverse Operation) 및 2단계 확인 핀코드/UI.
    - [x] **초기화 로직**: 데이터 리셋 시 자산 잔액 보존 옵션(Smart Reset).

- [x] **거래 목록 UI (Transaction List UX)**
    - [x] **시각화**: 일별 그룹핑, 카드형 레이아웃, 필터 칩.
    - [x] **성능**: `react-virtuoso` 가상화 및 `Fuse.js` 퍼지 검색.
    - [x] **다중 선택**: 롱프레스/호버 하이브리드 UX 및 일괄 삭제 액션 바.
    - [x] **신용카드**: 연도(Year) 구분 헤더 추가 및 결제일 로직 개선.

---

## 3. 주요 기능 모듈 (Feature Modules)
사용자가 직접 상호작용하는 핵심 기능들입니다.

- [x] **대시보드 (Dashboard)**
    - [x] **트렌드 분석**: 주간/월간 지출 흐름 그래프 및 토글.
    - [x] **위젯**: "재무 흐름" 단일 바 및 예산 현황 시각화.

- [x] **계획 & 지출 관리 (Planning & Bills)**
    - [x] **고정 지출(Bill)**: 청구서 그룹핑(여행, 교육 등) 및 캘린더 연동.
    - [x] **예산 관리**: 카테고리별 목표 금액 설정 및 달성률 표시.
    - [x] **구독 허브**: 정기 결제 캘린더 뷰 및 월별 예상 지출 요약.

- [x] Transfer Logic Refinement (V3: Positive Amount + ToAsset Flag)
    - [x] **Core Logic**: Update `useTransactionManager` balance calculation (Source has `toAssetId`, Dest has `null` but `linkedId`).
    - [x] **Reconciler**: Implement `useTransferReconciler` hook (Scan 5min window, Link Logic).
    - [x] **Dual Creation**: Implement `SmartInput` dual-record creation for manual transfers.
    - [x] **UI**: Implement `MergedTransferCard` in `TransactionItem`.
    - [x] **Integration**: Integrate Reconciler & Notification into `App.tsx`.
    - [x] **Unified View**:
        - [x] **Counterpart Strategy**: Credit Card Payment creates paired records (Source/Target).
        - [x] **Dual Rendering**: Unified "Source -> Target" display regardless of view.
        - [x] **Deduplication**: Smart filtering to prevent double-counting in All Transactions view.
    - [x] **Verification**: Manual Verification complete (Unified Experience confirmed).
- [x] **데이터 가져오기 (Import System)**
    - [x] **Excel/CSV 파싱**: `xlsx` 라이브러리 및 바이너리(.xls) 지원(한글 깨짐 해결).
    - [x] **Banking Mode**: 입/출금(Deposit/Withdrawal) 분리 컬럼 지원.
    - [x] **지능형 매핑**:
        - [x] **Smart Matching**: 점수 기반 자산 매칭.
        - [x] **Auto Tagging**: Merchant(@), Tag(#) 자동 파싱 및 변환.
        - [x] **Installment**: 할v부 개월 수(3개월, 03) 자동 인식.
    - [x] **중복 방지**:
        - [x] **Occurrence Indexing**: 동일 내용 연속 결제(#0, #1) 허용.
        - [x] **File Duplicate**: 파일 재업로드 시 완벽 차단.
    - [x] **UX**: 3단계 마법사(파일->매핑->미리보기) 및 결과 리포트.

---

## 4. UI/UX 및 디자인 시스템 (Design System)
앱의 룩앤필과 사용성을 담당합니다.

- [x] **디자인 시스템 (Design Language)**
    - [x] **토큰 & 아토믹**: 시맨틱 컬러 시스템 및 공통 컴포넌트(Button, Card) 구축.
    - [x] **일관성**: 버튼 스타일, 폰트, 빈 상태(Empty State) 통일.

- [x] **인터랙션 리팩토링 (Interaction)**
    - [x] **모달 시스템**: 헤더 제거(Headless), 제스처 우선 디자인, 중첩 모달 해결.
    - [x] **스마트 입력**: 아이콘 그리드, 자동완성, 키보드 핸들링 최적화.
    - [x] **피드백**: 토스트(Toast) 메시지 시스템 구축.
    - [x] **모바일 최적화**: 터치 영역 확대(44px+), 스티키 헤더, IP 리다이렉트 처리.

---

## 5. 설정 및 유지보수 (Settings & Maintenance)
앱 설정 및 데이터 관리 영역입니다.

- [x] **설정 (Settings)**
    - [x] **카테고리 관리**: 커스텀 카테고리 추가/수정/삭제 및 순서 변경 UI.
    - [x] **데이터 관리**: 엑셀 내보내기(Export) 및 데이터 초기화 옵션.
    - [x] **프로필**: 현재 사용자 정보 표시.

- [ ] **유지보수 및 확장 (Future)**
    - [ ] **프리셋 시스템**: 가져오기 매핑 설정 저장 기능.

---

## 6. 코드 최적화 및 리팩토링 (Code Optimization)
시스템 성능 및 유지보수성 향상을 위한 구조 개선 작업입니다.

- [x] **AssetManager 리팩토링** (Critical)
    - [x] `AssetForm.tsx` 분리: 입력 폼 컴포넌트 독립.
    - [x] `AssetDetailModal.tsx` 분리: 상세 보기 및 차트 로직 독립.
    - [x] `AssetCard.tsx` 분리: 리스트 아이템 컴포넌트 독립.
- [ ] **App.tsx 구조 개선** (High)
    - [x] `useModalManager`: 모달 상태 관리 로직 훅으로 추출.
    - [x] `useInitialization`: 초기 데이터 로딩 로직 분리 (Implemented as `useAppData`).
    - [x] `useInitialization`: 초기 데이터 로딩 로직 분리 (Implemented as `useAppData`).
    - [x] **성능 튜닝**: 대량 데이터 렌더링 최적화 지속 (TransactionList optimized).

- [ ] **Import UI/UX 개선** (Feature/import-ui-ux)
    - [x] **Phase 1**: MappingStep 시각적 개선 (테이블/컬럼 UI 고도화).
    - [ ] **Phase 1.5**: MappingStep 행 삭제/정리 기능 (User Request).
    - [x] **Phase 2**: 프리뷰 인라인 편집 (Implemented with Virtualization).
    - [ ] **Phase 3**: 스마트 카테고리 제안 (추후).
