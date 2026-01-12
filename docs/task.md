# 작업 목록 (Task List)

- [x] **피드백 시스템**
    - [x] 토스트 시스템 (Toast)

- [x] **대시보드 분석 (트렌드)**
    - [x] 차트 및 예산 바

- [x] **계획 탭(Planning Tab) 개편**
    - [x] 시각적 캘린더 스트립 & 분할 뷰
    - [x] **고정 지출(Bill) 관리 리팩토링** (Dashboard = 읽기 전용 철학)
        - [x] **대시보드 업데이트**:
            - [x] 거래 탭 헤더에 "고정 지출 관리" 버튼 생성.
        - [x] "그룹 이름" 입력 필드가 청구서 모달에 보이도록 수정.

        - [x] 새 청구서 생성 시 그룹 이름 작동 확인.
        - [x] 커스텀 그룹핑 설계:
            - [x] 사용자 정의 그룹 생성 허용 (예: "여행", "교육").
            - [x] 로직: 커스텀 탭 필터링 및 빈 상태 유지.
            - [x] 탭 삭제 구현.
            - [x] 대시보드 "다가오는 청구서" 리팩토링.

- [x] **목표 트래커(Goal Tracker) 충돌 수정**
    - [x] 목표 저장 시 화이트 스크린 충돌 디버깅 (필드 누락 수정).

- [x] **트렌드 탭 리팩토링**
    - [x] UX: 각 섹션별 **로컬 토글** (주간/월간) 구현.
    - [x] UI: "재무 흐름(Financial Flow)" 단일 바 디자인.

- [x] **그룹핑 및 가시성**
    - [x] **자산**: 자산 유형별 시각적 그룹화 (탭 인터페이스).
    - [x] **모달**: 표준 위치/크기 보장.

- [x] **일관성 (Consistency)**
    - [x] 버튼 스타일 및 트렌드 토글 디자인 통일.

- [x] **거래 로직 개편**
    - [x] **[버그] 기본 카테고리 중복 생성 수정** (Race Condition 해결).
    - [x] **1단계: 거래 훅/서비스(Hook/Service)**: `useTransactionManager` 도입.
    - [x] **2단계: App.tsx 리팩토링**: 로직 분리 및 통합.
    - [x] **3단계: 자산 관리자(Asset Manager) 통합**: 잔액 조정 로직 개선.

- [x] **거래 UI/UX 개편**
    - [x] **1단계: 시각화**: 카드 레이아웃, 날짜별 그룹핑, 필터 칩.
    - [x] **2단계: 성능**: 가상화(`react-virtuoso`) 및 퍼지 검색(`Fuse.js`).
    - [x] **3단계: 스마트 입력**: 아이콘 그리드 및 자동완성.
    - [x] **4단계: 리스트 다듬기**: 너비 제한, 타이포그래피, 호버 효과.
    - [x] **5단계: 모바일 최적화**: 터치 영역 확대, 스티키 헤더.

- [x] **디자인 시스템 개편**
    - [x] 스타일 감사 및 `design_system_proposal.md` 승인.
    - [x] 시맨틱 토큰(`primary`, `secondary` 등) 설정.
    - [x] 아토믹 컴포넌트(`Button`, `Card` 등) 생성 및 적용.
    - [x] **인터랙션 리팩토링**: 모달 시스템(`Dialog`, `MobileSheet`) 및 입력 폼 표준화.
    - [x] **완성도 향상**: 앱 셸, 네비게이션, 빈 상태 메시지 개선.

- [x] **데이터 가져오기 확장**
    - [x] Excel(`xlsx`) 지원 및 드래그 앤 드롭 구현.

- [x] **할부 로직 리팩토링**
    - [x] 월별 할부금 합산 로직(FinanceCalculator) 및 UI 표시 개선.

- [x] **컨텐츠 구성 및 설정 관리 (Content Strategy)**
    - [x] **앱 구조 개선**: 설정 페이지(`SettingsView`) 신설 및 라우팅 연결.
    - [x] **커스텀 카테고리**: DB 테이블 설계 및 관리 UI(순서 변경, CRUD) 구현.
    - [x] **로직 연동**: 트랜잭션 입력 시 동적 카테고리 반영.

- [x] **디버깅 및 안정화**
    - [x] 카테고리 RLS 인증 오류(익명 로그인) 및 중복 키 오류 수정.

- [ ] **[NEW] 보조 기능 확장 (Auxiliary Features)**
    - [x] **1순위: 예산 관리 시스템**
        - [x] 카테고리별 목표 금액 설정 및 시각화.
    - [x] **2순위: 태그 시스템 (Tagging)**
        - [x] 하이브리드 태그 전략(#해시태그) 및 자동완성 DB 구축.
    - [x] **모달 시스템 전면 개편 (Modal System Revamp)**
        - [x] **표준화**: 헤더/바디/푸터 레이아웃 통일.
        - [x] **Headless 정책 도입**: 상단 헤더 제거 및 'Clean & Gesture-First' 적용.
        - [x] **UI 정리**: 모든 모달의 상단 X 버튼 제거, 중첩 모달(Nested Modal) 문제 해결.
        - [x] **UX 개선**: Asset Form 하단 Cancel 버튼 추가.
    - [x] **스마트 입력(Smart Input) 로직 수정**
        - [x] **카테고리 연동**: `App.tsx` 데이터 전달 누락 수정 (동적 필터링 활성화).
        - [x] **타입 안정성**: `merchant` 필드 타입 정의 업데이트.
    
    - [x] **3순위: 자산 정보 고도화 (Asset Information Enhancement)**
        - [x] **기획 (Planning)**: 자산 유형별(부동산, 투자 등) 상세 스키마 정의.
        - [x] **데이터베이스 (Database)**: Supabase 스키마 업데이트 (`institution`, `account_number`, 상세 필드 등).
        - [x] **UI/UX 구현**:
            - [x] `AssetManager` 입력 모달 고도화 (유형별 동적 필드).
            - [x] 자산 상세 보기(Detail Modal) 시각화 강화 (예: 대출 상환 그래프).
            - [x] 실물 카드/통장 메타포 디자인 적용.
        - [x] **로직 (Logic)**: 고급 계산 로직 (대출 상환, 이자, 신용카드 한도 등) 구현.
        - [x] **편의성**: 총자산 제외 옵션, 키보드 핸들링 최적화.

    - [x] **4순위: 정기 결제 중앙 통제 (Subscription Hub)**
        - [x] **데이터 로직**: `RecurringTransaction` 인터페이스 확장 및 상태 판별 헬퍼(`getBillStatus`) 구현.
        - [x] **캘린더 뷰**: `SubscriptionView` 생성 및 월간 캘린더 컴포넌트 구현.
        - [x] **요약 카드**: 월별 예상 지출 및 잔여 금액 계산 로직.
        - [x] **네비게이션**: Planning 탭 내 진입점 아이콘 추가 (캘린더 통합으로 대체).
    
    - [x] **5순위: 데이터 백업 (Data Management)**
        - [x] **ExportService**: `xlsx` 라이브러리를 활용한 다중 시트 엑셀 내보내기 구현.
        - [x] **UI 통합**: 설정 페이지에 '데이터 내보내기' 및 '초기화' 섹션 추가.

    - [x] **6순위: 인증 시스템 개편 (Authentication)**
        - [x] **코드 점검 및 제거**: `App.tsx`, `SupabaseService`의 익명/가짜 로그인 로직 분석 및 삭제.
        - [x] **Real Login 구현**: Supabase Auth (이메일/패스워드) 정식 연동 및 UI(`LoginView`) 구현.
        - [x] **보안 강화**: 실제 User ID 기반의 RLS 정책 수립 및 데이터 격리(Isolation) 적용.
        - [x] **Google 로그인 연동**: Provider 설정 및 연동 테스트.
        - [x] **보안 심화 (Security+)**:
            - [x] **동시 접속 차단**: `profiles` 테이블을 활용한 단일 세션(Single Device) 강제 로직 구현.
        - [x] **사용자 프로필 표시**:
            - [x] 사이드바에 현재 로그인된 사용자 이메일 표시.
        - [x] **모바일 지원 디버깅**:
            - [x] **White Screen 수정**: `crypto.randomUUID` 호환성 문제 해결.
            - [x] **Google 로그인 이슈**: 모바일 IP Redirect URL 설정 가이드 제공.
            - [x] **새로고침 시 데이터 사라짐**: `loadData` 타이밍 이슈 해결 (Delay 추가 및 중복 컷).
            - [x] **새로고침 시 앱 멈춤(Hang)**: 세션 등록 로직 비동기(Non-blocking) 처리.
            - [x] **세션 유지**: `localStorage`를 활용한 기기 ID 영구 보존.

    - [/] **7순위: CSV 가져오기 재구축 (CSV Import Refactor)**
        - [x] **1단계: 서비스 리팩토링 (Service Layer)**
            - [x] `ImportService`: `xlsx` 라이브러리 기반의 강력한 파싱 로직 구현.
            - [x] **Column Mapping**: 유동적인 컬럼 매핑(`parseRawData`) 로직 구현.
        - [x] **2단계: 마법사 UI 구현 (Wizard UI)**
            - [x] `ImportWizardModal`: 3단계(파일선택 -> 매핑 -> 미리보기) 스테퍼 UI.
            - [x] `ColumnMapper`: 데이터 그리드 및 드롭다운 매핑 UI.
            - [x] `ImportPreview`: 유효 데이터/중복 데이터 요약 리포트 UI.
        - [ ] **3단계: 프리셋 시스템 (Future)**
            - [ ] 매핑 설정 저장/불러오기 기능 (localStorage 활용).

    - [x] **8순위: 디자인 일관성 폴리싱 (Design Polish)**
        - [x] **Import Wizard**: 블루 컬러 제거 -> Slate/Emerald 적용.
        - [x] **Modal**: 헤더 제거 및 버튼 둥글기(Rounded-2xl) 표준화.
        - [x] **Typography**: 하드코딩된 폰트 크기/색상 토큰화.
