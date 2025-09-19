Build Error
Failed to compile

Next.js (14.2.32) is outdated (learn more)
app/layout.tsx
An error occurred in `next/font`.

Error: Cannot find module 'tailwindcss'
Require stack:
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/config/blocks/css/plugins.js
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/config/blocks/css/index.js
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/config/index.js
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack-config.js
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/dev/hot-reloader-webpack.js
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/lib/router-server.js
- /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/lib/start-server.js
    at Function.<anonymous> (node:internal/modules/cjs/loader:1365:15)
    at /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/require-hook.js:55:36
    at Function.resolve (node:internal/modules/helpers:145:19)
    at loadPlugin (/Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/config/blocks/css/plugins.js:49:32)
    at /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/config/blocks/css/plugins.js:157:56
    at Array.map (<anonymous>)
    at getPostCssPlugins (/Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/config/blocks/css/plugins.js:157:47)
    at async /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/config/blocks/css/index.js:124:36
    at async /Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/build/webpack/loaders/next-font-loader/index.js:86:33
    at async Span.traceAsyncFn (/Users/zuobowen/Documents/GitHub/SonoScope/node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/trace/trace.js:154:20)
This error occurred during the build process and can only be dismissed by fixing the error.