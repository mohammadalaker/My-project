import { QueryClient } from '@tanstack/react-query';

/** افتراضي: البيانات تُعتبر طازجة 5 دقائق — عند التنقل بين الصفحات لا يُعاد الطلب لـ Supabase إن لم تنتهِ المهلة */
export const QUERY_STALE_DEFAULT_MS = 1000 * 60 * 5;

/**
 * تقارير / لوحات ثقيلة (مثل dashboard orders): مهلة أطول لتقليل إعادة التحميل والضغط على Supabase.
 * استخدمها في useQuery { staleTime: QUERY_STALE_REPORTS_MS } للاستعلامات الكبيرة.
 */
export const QUERY_STALE_REPORTS_MS = 1000 * 60 * 10;

/** كاش طلبات الشبكة: لا إعادة جلب تلقائية عند التركيز على النافذة لتوفير البيانات */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_DEFAULT_MS,
      gcTime: 1000 * 60 * 30, // 30 دقيقة احتفاظ بالكاش بعد عدم الاستخدام
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
