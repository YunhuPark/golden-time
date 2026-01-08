# 🔧 Supabase 이메일 확인 오류 해결

## 문제
- 회원가입 후 "Email not confirmed" 오류 발생
- 로그인 시 400 Bad Request 에러

## 해결 방법

### Option 1: 이메일 확인 비활성화 (개발용 - 권장)

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard/project/aiggzhblnuxkgzzmsgrl

2. **Authentication 설정**
   - 좌측 메뉴: **Authentication** → **Providers**
   - **Email** 프로바이더 선택

3. **이메일 확인 비활성화**
   - **"Confirm email"** 체크 해제
   - **Save** 클릭

4. **앱에서 다시 회원가입**
   - 기존 계정 삭제: Authentication → Users → 방금 만든 계정 삭제
   - 앱에서 새로 회원가입
   - 바로 로그인 가능!

### Option 2: 이메일 확인하기 (프로덕션용)

1. **이메일 확인**
   - 회원가입 시 입력한 이메일 확인
   - Supabase에서 발송한 확인 이메일 열기
   - "Confirm your email" 링크 클릭

2. **수동 확인 (테스트용)**
   - Supabase Dashboard → Authentication → Users
   - 해당 유저 클릭
   - **"Confirm email"** 버튼 클릭

---

## 빠른 테스트 방법

**가장 빠른 방법**: Option 1 (이메일 확인 비활성화)

1. https://supabase.com/dashboard/project/aiggzhblnuxkgzzmsgrl/auth/providers
2. Email → "Confirm email" 체크 해제 → Save
3. 앱에서 새 계정으로 회원가입
4. 바로 로그인!

---

## 추가: Google OAuth 설정 (선택)

현재 Google 로그인은 설정되지 않았습니다. 설정하려면:

1. **Google Cloud Console**
   - https://console.cloud.google.com

2. **OAuth 2.0 Client ID 생성**
   - APIs & Services → Credentials
   - Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     https://aiggzhblnuxkgzzmsgrl.supabase.co/auth/v1/callback
     ```

3. **Supabase에 등록**
   - Supabase Dashboard → Authentication → Providers → Google
   - Enable Google Provider
   - Client ID와 Client Secret 입력
   - Save

---

**개발 중에는 Option 1 (이메일 확인 비활성화)을 권장합니다!**
