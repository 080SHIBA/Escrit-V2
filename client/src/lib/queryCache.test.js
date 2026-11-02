import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetForTests, clearPrivateCache, fetchQuery, getEntry, invalidate, isFresh, setData, subscribe,
} from './queryCache.js';

test.beforeEach(() => __resetForTests());

test('returns cached data without a second request while fresh', async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return { n: calls }; };
  await fetchQuery('pub:a', fetcher, { staleTime: 1000 });
  const again = await fetchQuery('pub:a', fetcher, { staleTime: 1000 });
  assert.equal(calls, 1);
  assert.deepEqual(again, { n: 1 });
});

test('shares one in-flight request between simultaneous callers', async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; await new Promise((r) => setTimeout(r, 10)); return 'ok'; };
  const [a, b] = await Promise.all([fetchQuery('pub:b', fetcher), fetchQuery('pub:b', fetcher)]);
  assert.equal(calls, 1);
  assert.equal(a, b);
});

test('identical refresh keeps the same object reference', async () => {
  setData('pub:c', { id: 1 });
  const first = getEntry('pub:c').data;
  setData('pub:c', { id: 1 });
  assert.equal(getEntry('pub:c').data, first);
});

test('notifies subscribers only when data really changes', () => {
  let hits = 0;
  const off = subscribe('pub:d', () => { hits += 1; });
  setData('pub:d', { v: 1 });
  setData('pub:d', { v: 1 });
  setData('pub:d', { v: 2 });
  off();
  assert.equal(hits, 2);
});

test('retries network failures but not 4xx errors', async () => {
  let calls = 0;
  const flaky = async () => { calls += 1; if (calls < 3) throw new Error('network'); return 'done'; };
  assert.equal(await fetchQuery('pub:e', flaky, { retryDelays: [1, 1] }), 'done');
  let notFoundCalls = 0;
  const notFound = async () => { notFoundCalls += 1; throw Object.assign(new Error('nope'), { status: 404 }); };
  await assert.rejects(fetchQuery('pub:f', notFound, { retryDelays: [1, 1] }));
  assert.equal(notFoundCalls, 1);
});

test('merge keeps extra pages when page one is refreshed', async () => {
  setData('pub:g', { items: [1, 2, 3, 4], cursor: 'c2' });
  const merged = await fetchQuery('pub:g', async () => ({ items: [1, 2], cursor: 'c1' }), {
    force: true,
    merge: (old, fresh) => ({ items: [...fresh.items, ...old.items.filter((i) => !fresh.items.includes(i))], cursor: old.cursor }),
  });
  assert.deepEqual(merged.items, [1, 2, 3, 4]);
});

test('clearPrivateCache removes u: keys but keeps public data', () => {
  setData('u:orders', [1]);
  setData('pub:listings', [2]);
  clearPrivateCache();
  assert.equal(getEntry('u:orders'), null);
  assert.deepEqual(getEntry('pub:listings').data, [2]);
});

test('invalidate marks matching entries stale', () => {
  setData('pub:h:1', 'x');
  assert.equal(isFresh('pub:h:1', 1000), true);
  invalidate('pub:h');
  assert.equal(isFresh('pub:h:1', 1000), false);
});
