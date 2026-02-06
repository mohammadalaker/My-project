import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const hasValidEnv = supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder');

const emptyPromise = Promise.resolve({ data: [], error: null });
const thenable = {
  then: (fn, rej) => emptyPromise.then(fn, rej),
  catch: (fn) => emptyPromise.catch(fn),
};

/** Mock client so the app never crashes when Supabase is missing or invalid. */
function createMockClient() {
  const chain = {
    order: () => chain,
    or: () => chain,
    range: () => thenable,
    then: (fn, rej) => emptyPromise.then(fn, rej),
    catch: (fn) => emptyPromise.catch(fn),
    eq: () => ({ then: (fn) => fn({ data: null, error: null }), catch: (fn) => fn({}) }),
  };
  return {
    from: () => ({
      select: () => chain,
      update: () => ({ eq: () => ({ then: (fn, rej) => emptyPromise.then(fn, rej), catch: (f) => emptyPromise.catch(f) }) }),
      insert: () => emptyPromise,
      delete: () => ({ eq: () => emptyPromise }),
    }),
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({ data: { publicUrl: path ? `/${path}` : '' } }),
        upload: () => emptyPromise,
        remove: () => emptyPromise,
      }),
    },
  };
}

let client;
try {
  if (hasValidEnv) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    client = createMockClient();
  }
} catch (e) {
  console.warn('Supabase client init failed:', e);
  client = createMockClient();
}

export const supabase = client;
