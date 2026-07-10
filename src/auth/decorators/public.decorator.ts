import { SetMetadata } from '@nestjs/common';

/**
 * 인증 가드가 공개 여부를 판단할 때 사용하는 메타데이터 키.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 컨트롤러 또는 라우트 핸들러에 붙여 인증(AccessTokenGuard)을 건너뛰도록 표시하는 데코레이터.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
