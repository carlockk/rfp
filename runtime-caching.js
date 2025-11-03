import defaultRuntimeCaching from 'next-pwa/cache.js';

const runtimeCaching = [
  ...defaultRuntimeCaching,
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/api/evaluations'),
    method: 'POST',
    handler: 'NetworkOnly',
    options: {
      backgroundSync: {
        name: 'evaluationsQueue',
        options: {
          maxRetentionTime: 24 * 60 // 24 horas
        }
      },
      cacheableResponse: {
        statuses: [200, 201, 202]
      }
    }
  }
];

export default runtimeCaching;
