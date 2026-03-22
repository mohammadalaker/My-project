import { QueryClient } from '@tanstack/react-query';

/** كاش طلبات الشبكة: لا إعادة جلب تلقائية عند التركيز على النافذة لتوفير البيانات */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 دقائق قبل اعتبار البيانات قديمة
      gcTime: 1000 * 60 * 30, // 30 دقيقة احتفاظ بالكاش بعد عدم الاستخدام
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
