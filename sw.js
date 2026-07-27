// STRANGE SIGNALS service worker — stale-while-revalidate cache for big data files.
// First visit: data fetched from network as normal, then cached.
// Repeat visits: cached copy served instantly, network fetch in background updates the cache.
// Bump CACHE_VERSION when the data file format changes (forces re-fetch on next activate).
const CACHE_VERSION='strange-signals-data-v6';  // bump when /data/* content changes (v6: full pipeline rebuild, UFO sharded)

// Cache same-origin requests under /data/ — the big sightings file plus the overlay JSONs.
// Code (HTML/JS/CSS) is intentionally NOT cached so iteration during dev is normal.
function isCacheable(url){
  if(url.origin!==self.location.origin)return false;
  return url.pathname.indexOf('/data/')!==-1;
}

self.addEventListener('install',function(){self.skipWaiting()});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE_VERSION}).map(function(k){return caches.delete(k)}));
    }).then(function(){return self.clients.claim()})
  );
});

self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(!isCacheable(url))return;
  e.respondWith(
    caches.open(CACHE_VERSION).then(function(cache){
      return cache.match(e.request).then(function(cached){
        const fetchPromise=fetch(e.request).then(function(resp){
          if(resp&&resp.ok)cache.put(e.request,resp.clone());
          return resp;
        }).catch(function(){return cached});
        // Cache-first when present (instant), background update keeps it fresh.
        return cached||fetchPromise;
      });
    })
  );
});
