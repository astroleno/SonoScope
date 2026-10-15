export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/SonoScope';
export const appPath = (path: string) => `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
