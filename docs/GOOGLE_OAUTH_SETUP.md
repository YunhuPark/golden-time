# 🔑 Google OAuth 로그인 설정 가이드

## 📋 개요

Google 계정으로 간편하게 로그인할 수 있도록 OAuth 2.0을 설정합니다.

---

## 1단계: Google Cloud Console 설정

### 1.1 프로젝트 생성 또는 선택

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com

2. **프로젝트 선택/생성**
   - 상단 프로젝트 드롭다운 클릭
   - 기존 프로젝트 선택 또는 "새 프로젝트" 클릭
   - 프로젝트 이름: `Golden Time` (또는 원하는 이름)

### 1.2 OAuth 동의 화면 구성

1. **OAuth 동의 화면 메뉴로 이동**
   - 좌측 메뉴: **APIs & Services** → **OAuth consent screen**

2. **User Type 선택**
   - **External** 선택 (외부 사용자도 로그인 가능)
   - **CREATE** 클릭

3. **앱 정보 입력**
   - **App name**: `Golden Time`
   - **User support email**: 본인 이메일 주소
   - **App logo**: (선택사항)
   - **Application home page**: `http://localhost:3008` (개발용)
   - **Developer contact information**: 본인 이메일 주소
   - **SAVE AND CONTINUE** 클릭

4. **Scopes 설정**
   - 기본값 그대로 사용 (email, profile, openid)
   - **SAVE AND CONTINUE** 클릭

5. **Test users** (선택사항)
   - 개발 중에는 건너뛰기
   - **SAVE AND CONTINUE** 클릭

6. **Summary 확인**
   - **BACK TO DASHBOARD** 클릭

### 1.3 OAuth 2.0 Client ID 생성

1. **Credentials 메뉴로 이동**
   - 좌측 메뉴: **APIs & Services** → **Credentials**

2. **Create Credentials**
   - 상단 **+ CREATE CREDENTIALS** 클릭
   - **OAuth client ID** 선택

3. **Application type 선택**
   - **Application type**: **Web application**
   - **Name**: `Golden Time Web Client`

4. **Authorized redirect URIs 추가**
   - **ADD URI** 클릭
   - 다음 URI를 **정확히** 입력:
     ```
     https://aiggzhblnuxkgzzmsgrl.supabase.co/auth/v1/callback
     ```

   ⚠️ **중요**: URL을 정확하게 입력하세요! 오타가 있으면 작동하지 않습니다.

5. **CREATE** 클릭

6. **Client ID와 Client Secret 복사**
   - 팝업에서 **Client ID**와 **Client Secret** 복사
   - 메모장에 임시 저장

---

## 2단계: Supabase에 Google OAuth 등록

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard/project/aiggzhblnuxkgzzmsgrl/auth/providers

2. **Google Provider 활성화**
   - **Google** 항목 찾기
   - **Enabled** 토글 켜기

3. **Client ID와 Client Secret 입력**
   - **Client ID (for OAuth)**: 복사한 Client ID 붙여넣기
   - **Client Secret (for OAuth)**: 복사한 Client Secret 붙여넣기

4. **Save** 클릭

---

## 3단계: 앱에서 테스트

1. **개발 서버 실행 확인**
   - http://localhost:3008 접속

2. **Google 로그인 테스트**
   - 즐겨찾기 버튼 (☆) 클릭
   - 로그인 모달에서 **"🔍 Google로 계속하기"** 버튼 클릭
   - Google 계정 선택
   - 권한 승인
   - ✅ 로그인 완료!

---

## 📝 요약

### Google Cloud Console에서:
1. 프로젝트 생성
2. OAuth 동의 화면 구성
3. OAuth 2.0 Client ID 생성
4. Redirect URI: `https://aiggzhblnuxkgzzmsgrl.supabase.co/auth/v1/callback`

### Supabase Dashboard에서:
1. Authentication → Providers → Google
2. Client ID와 Client Secret 입력
3. Save

---

## 🐛 문제 해결

### "redirect_uri_mismatch" 오류
- **원인**: Redirect URI가 정확하지 않음
- **해결**: Google Cloud Console에서 정확한 URI 재확인
  ```
  https://aiggzhblnuxkgzzmsgrl.supabase.co/auth/v1/callback
  ```

### "Access blocked: This app's request is invalid"
- **원인**: OAuth 동의 화면 설정 미완료
- **해결**: Google Cloud Console → OAuth consent screen 완료

### 로그인 후 아무 반응 없음
- **원인**: Supabase에 Client ID/Secret 미입력
- **해결**: Supabase Dashboard에서 Google Provider 설정 확인

---

## 🎉 완료!

Google 로그인이 정상적으로 작동하면, 사용자는:
- 이메일/비밀번호 없이 Google 계정으로 간편 로그인
- 즐겨찾기, 의료 정보, 방문 기록 등 모든 프리미엄 기능 사용 가능!
