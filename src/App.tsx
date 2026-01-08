import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './presentation/pages/HomePage';
import { EcgLoader } from './presentation/components/common/EcgLoader';

// Lazy load non-critical routes for faster initial load (LCP optimization)
const EmergencySharePage = lazy(() =>
  import('./presentation/pages/EmergencySharePage').then(module => ({
    default: module.EmergencySharePage
  }))
);

/**
 * App Component
 * 애플리케이션의 루트 컴포넌트
 *
 * Performance Optimizations for Emergency Response (Target: LCP < 1.5s):
 * - Lazy loading for non-critical routes (EmergencySharePage)
 * - Non-blocking encryption validation (deferred with dynamic import)
 * - Deferred HTTPS redirect check (next tick)
 * - Critical path: HomePage loads immediately
 */
function App() {
  useEffect(() => {
    // 앱 시작 시 암호화 설정 검증 (비동기, 논블로킹)
    // Use dynamic import to defer validation until after initial render
    import('./infrastructure/utils/encryption').then(({ validateEncryptionSetup }) => {
      validateEncryptionSetup().then((isValid) => {
        if (!isValid) {
          console.error('❌ Encryption setup validation failed!');
        }
      });
    });

    // HTTPS 강제 (프로덕션) - defer to next tick to not block render
    if (import.meta.env.PROD && window.location.protocol === 'http:') {
      setTimeout(() => {
        window.location.href = window.location.href.replace('http:', 'https:');
      }, 0);
    }

    // 페이지 이탈 방지 (응급 검색 중일 때)
    const handleBeforeUnload = () => {
      // 실제로는 검색 중인지 상태 체크 필요
      // if (isSearching) {
      //   e.preventDefault();
      //   e.returnValue = '응급 검색을 종료하시겠습니까?';
      // }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <Router>
      <div className="App">
        <Suspense fallback={<EcgLoader message="LOADING EMERGENCY PAGE..." />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/emergency/:token" element={<EmergencySharePage />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
