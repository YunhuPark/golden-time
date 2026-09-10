const fs = require('fs');

function replaceExact(path, before, after, expected = 1) {
  let text = fs.readFileSync(path, 'utf8');
  const count = text.split(before).length - 1;
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} match(es), found ${count}`);
  }
  text = text.split(before).join(after);
  fs.writeFileSync(path, text);
}

replaceExact(
  'src/presentation/components/hospital/HospitalCard.tsx',
  '(window as any).cancelIdleCallback(idleCallback);',
  'window.cancelIdleCallback(idleCallback);',
  2
);
replaceExact(
  'src/presentation/components/hospital/HospitalCard.tsx',
  `    } catch (error: any) {\n      if (isSessionExpiredError(error)) {\n        setShowSessionModal(true);\n        logError(error, { area: 'auth', severity: 'medium', extra: { operation: 'toggleFavorite', hospital: hospital.name } });`,
  `    } catch (error: unknown) {\n      if (isSessionExpiredError(error)) {\n        setShowSessionModal(true);\n        const normalizedError = error instanceof Error ? error : new Error(String(error));\n        logError(normalizedError, { area: 'auth', severity: 'medium', extra: { operation: 'toggleFavorite', hospital: hospital.name } });`
);

replaceExact(
  'src/presentation/components/map/KakaoMap.tsx',
  `  const mapRef = useRef<any>(null);\n  const markersRef = useRef<any[]>([]);`,
  `  type KakaoMapInstance = InstanceType<typeof window.kakao.maps.Map>;\n  type KakaoOverlayInstance = InstanceType<typeof window.kakao.maps.CustomOverlay>;\n  const mapRef = useRef<KakaoMapInstance | null>(null);\n  const markersRef = useRef<Array<{ overlay: KakaoOverlayInstance; hospitalId: string }>>([]);`
);
replaceExact(
  'src/presentation/components/map/KakaoMap.tsx',
  `    let currentOpenInfoId: string | null = null;\n\n    (window as any).toggleMarkerInfo = (hospitalId: string) => {`,
  `    let currentOpenInfoId: string | null = null;\n    const markerInfoWindow = window as typeof window & {\n      toggleMarkerInfo?: (hospitalId: string) => void;\n    };\n\n    markerInfoWindow.toggleMarkerInfo = (hospitalId: string) => {`
);
replaceExact(
  'src/presentation/components/map/KakaoMap.tsx',
  '      delete (window as any).toggleMarkerInfo;',
  '      delete markerInfoWindow.toggleMarkerInfo;'
);

replaceExact(
  'src/presentation/hooks/useAuthSession.ts',
  '  handleSessionError: (error: any) => boolean; // Returns true if session expired',
  '  handleSessionError: (error: unknown) => boolean; // Returns true if session expired'
);
replaceExact(
  'src/presentation/hooks/useAuthSession.ts',
  `    (error: any): boolean => {\n      if (!error) return false;\n\n      const errorMessage = error.message || String(error);\n      const isJWTError =\n        errorMessage.includes('JWT') ||\n        errorMessage.includes('jwt') ||\n        errorMessage.includes('token') ||\n        errorMessage.includes('expired') ||\n        errorMessage.includes('unauthorized') ||\n        errorMessage.includes('not authenticated') ||\n        error.status === 401 ||\n        error.code === 'PGRST301'; // PostgREST JWT expired`,
  `    (error: unknown): boolean => {\n      if (!error) return false;\n\n      const candidate =\n        typeof error === 'object' && error !== null\n          ? (error as { message?: unknown; status?: unknown; code?: unknown })\n          : {};\n      const errorMessage =\n        typeof candidate.message === 'string' ? candidate.message : String(error);\n      const errorStatus = typeof candidate.status === 'number' ? candidate.status : undefined;\n      const errorCode = typeof candidate.code === 'string' ? candidate.code : undefined;\n      const isJWTError =\n        errorMessage.includes('JWT') ||\n        errorMessage.includes('jwt') ||\n        errorMessage.includes('token') ||\n        errorMessage.includes('expired') ||\n        errorMessage.includes('unauthorized') ||\n        errorMessage.includes('not authenticated') ||\n        errorStatus === 401 ||\n        errorCode === 'PGRST301'; // PostgREST JWT expired`
);
replaceExact(
  'src/presentation/hooks/useAuthSession.ts',
  `          error_code: error.code,\n          error_status: error.status,`,
  `          error_code: errorCode,\n          error_status: errorStatus,`
);

replaceExact(
  'src/presentation/pages/HomePage.tsx',
  '      } catch (e) {',
  '      } catch {'
);

console.log('Production runtime type cleanup applied.');
