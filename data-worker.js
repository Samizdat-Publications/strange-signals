/* ========== DATA LOADING WEB WORKER ========== */
/* Offloads JSON fetch + parse + validation + category sorting to background thread */
'use strict';

self.onmessage = function(e) {
  var url = e.data.url;
  var F = {LAT:0, LON:1, CAT:2, DATE:3, LOC:4, SUB:5, DESC:6};

  self.postMessage({type:'progress', pct:5, msg:'Fetching sighting data...'});

  fetch(url)
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      self.postMessage({type:'progress', pct:15, msg:'Downloading data...'});
      return resp.text();
    })
    .then(function(text) {
      self.postMessage({type:'progress', pct:25, msg:'Parsing JSON (' + (text.length / 1048576).toFixed(1) + ' MB)...'});
      var json = JSON.parse(text);
      text = null; // Free memory

      var raw = json.data;
      if (!Array.isArray(raw) || !raw.length) {
        self.postMessage({type:'error', msg:'Invalid or empty data'});
        return;
      }

      self.postMessage({type:'progress', pct:40, msg:'Validating ' + raw.length.toLocaleString() + ' records...'});

      // Filter + sort into categories in one pass
      var allData = [];
      var catArrays = [[], [], []];
      var i, r, len = raw.length;
      var batchReport = Math.floor(len / 5);

      for (i = 0; i < len; i++) {
        r = raw[i];
        if (Array.isArray(r) && r.length >= 7 &&
            typeof r[F.LAT] === 'number' && !isNaN(r[F.LAT]) &&
            typeof r[F.LON] === 'number' && !isNaN(r[F.LON]) &&
            r[F.CAT] >= 0 && r[F.CAT] < 3) {
          allData.push(r);
          catArrays[r[F.CAT]].push(r);
        }
        if (i > 0 && i % batchReport === 0) {
          self.postMessage({
            type:'progress',
            pct: 40 + Math.round((i / len) * 30),
            msg: 'Indexing ' + i.toLocaleString() + ' of ' + len.toLocaleString() + '...'
          });
        }
      }

      raw = null; // Free memory
      json = null;

      self.postMessage({
        type:'progress',
        pct: 75,
        msg: allData.length.toLocaleString() + ' records validated'
      });

      // Transfer the data back
      self.postMessage({
        type: 'complete',
        allData: allData,
        catArrays: catArrays,
        totalRaw: len
      });
    })
    .catch(function(err) {
      self.postMessage({type:'error', msg: err.message});
    });
};
