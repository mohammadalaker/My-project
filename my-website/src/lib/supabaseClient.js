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
  const noopChannel = {
    on: () => noopChannel,
    subscribe: () => noopChannel,
  };
  const noopRemoveChannel = () => { };
  return {
    from: () => ({
      select: () => chain,
      update: () => ({ eq: () => ({ then: (fn, rej) => emptyPromise.then(fn, rej), catch: (f) => emptyPromise.catch(f) }) }),
      insert: () => emptyPromise,
      delete: () => ({ eq: () => emptyPromise }),
    }),
    channel: () => noopChannel,
    removeChannel: noopRemoveChannel,
    storage: {
      from: () => ({
        getPublicUrl: (path, options) => {
          if (!path) return { data: { publicUrl: '' } };
          const objectBase = supabaseUrl
            ? `${supabaseUrl}/storage/v1/object/public/bucket/${path}`
            : `/${path}`;
          if (options?.transform && supabaseUrl) {
            const q = new URLSearchParams();
            const t = options.transform;
            if (t.width != null) q.set('width', String(t.width));
            if (t.height != null) q.set('height', String(t.height));
            if (t.quality != null) q.set('quality', String(t.quality));
            if (t.resize) q.set('resize', t.resize);
            const qs = q.toString();
            return {
              data: {
                publicUrl: `${supabaseUrl}/storage/v1/render/image/public/bucket/${path}${qs ? `?${qs}` : ''}`,
              },
            };
          }
          return { data: { publicUrl: objectBase } };
        },
        upload: () => emptyPromise,
        remove: () => emptyPromise,
      }),
    },
  };
}

const mock = createMockClient();
let client = mock;

try {
  if (hasValidEnv) {
    const real = createClient(supabaseUrl, supabaseAnonKey);
    client = real;
  } else {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
  }
} catch (e) {
  console.warn('Supabase client init failed:', e);
}

if (typeof client.channel !== 'function') {
  console.warn('Supabase client missing channel method. Polyfilling...');
  client.channel = mock.channel;
} else {
  console.log('Supabase client has channel method.');
}

if (typeof client.removeChannel !== 'function') {
  client.removeChannel = mock.removeChannel;
}

// Final check
if (typeof client.channel !== 'function') {
  console.error('CRITICAL: Supabase client still missing channel method after polyfill attempts.');
  client.channel = () => ({ on: () => ({ subscribe: () => { } }), subscribe: () => { } });
}

export const supabase = client;
export default client;
