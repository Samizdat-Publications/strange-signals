/* ========== SIGNAL CHARTS ========== */
(function(){
'use strict';

const DEFAULTS={
  bar:{aspect:16/9,margin:{top:28,right:12,bottom:32,left:44}},
  line:{aspect:16/9,margin:{top:28,right:12,bottom:32,left:44}},
  pie:{aspect:1,margin:{top:28,right:12,bottom:12,left:12}},
  scatter:{aspect:4/3,margin:{top:28,right:12,bottom:36,left:44}}
};
const FALLBACK_COLORS=['#00ff88','#ff6622','#aa44ff','#00ccff','#ff3366','#ffcc00'];

function render(container,opts){
  const type=opts.chart_type||'bar';
  const data=opts.data||[];
  if(!data.length)return;

  const cfg=DEFAULTS[type]||DEFAULTS.bar;
  const w=container.clientWidth||360;
  const h=Math.round(w/cfg.aspect);
  const m=cfg.margin;
  const iw=w-m.left-m.right;
  const ih=h-m.top-m.bottom;

  const svg=d3.select(container).append('svg')
    .attr('viewBox',`0 0 ${w} ${h}`)
    .attr('width','100%')
    .style('overflow','visible');

  // Title
  if(opts.title){
    svg.append('text').attr('x',w/2).attr('y',16)
      .attr('text-anchor','middle').attr('fill','#e0e0e0')
      .style('font-family','Orbitron,monospace').style('font-size','10px')
      .style('letter-spacing','1px').text(opts.title.toUpperCase());
  }

  const g=svg.append('g').attr('transform',`translate(${m.left},${m.top})`);

  if(type==='bar')renderBar(g,data,iw,ih,opts);
  else if(type==='line')renderLine(g,data,iw,ih,opts);
  else if(type==='pie')renderPie(svg,data,w,h,m,opts);
  else if(type==='scatter')renderScatter(g,data,iw,ih,opts);
}

function renderBar(g,data,w,h,opts){
  const x=d3.scaleBand().domain(data.map(d=>d.label||'')).range([0,w]).padding(0.3);
  const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.value)||1]).nice().range([h,0]);

  // Axes
  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.selectAll('.domain,.tick line').attr('stroke','#333');

  // Bars
  g.selectAll('.bar').data(data).enter().append('rect')
    .attr('x',d=>x(d.label||''))
    .attr('y',d=>y(d.value||0))
    .attr('width',x.bandwidth())
    .attr('height',d=>h-y(d.value||0))
    .attr('fill',(d,i)=>d.color||FALLBACK_COLORS[i%FALLBACK_COLORS.length])
    .attr('rx',2).attr('opacity',0.85);

  // Labels
  if(opts.x_label)g.append('text').attr('x',w/2).attr('y',h+28)
    .attr('text-anchor','middle').attr('fill','#666').style('font-size','8px').text(opts.x_label);
  if(opts.y_label)g.append('text').attr('transform','rotate(-90)')
    .attr('x',-h/2).attr('y',-32).attr('text-anchor','middle')
    .attr('fill','#666').style('font-size','8px').text(opts.y_label);
}

function renderLine(g,data,w,h,opts){
  const x=d3.scalePoint().domain(data.map(d=>d.label||'')).range([0,w]).padding(0.5);
  const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.value)||1]).nice().range([h,0]);

  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x))
    .selectAll('text').attr('fill','#888').style('font-size','8px')
    .attr('transform','rotate(-30)').style('text-anchor','end');
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.selectAll('.domain,.tick line').attr('stroke','#333');

  const line=d3.line().x(d=>x(d.label||'')).y(d=>y(d.value||0)).curve(d3.curveMonotoneX);
  const color=data[0]?.color||FALLBACK_COLORS[0];

  // Area fill
  const area=d3.area().x(d=>x(d.label||'')).y0(h).y1(d=>y(d.value||0)).curve(d3.curveMonotoneX);
  g.append('path').datum(data).attr('d',area).attr('fill',color).attr('opacity',0.1);

  // Line
  g.append('path').datum(data).attr('d',line)
    .attr('fill','none').attr('stroke',color).attr('stroke-width',2);

  // Dots
  g.selectAll('.dot').data(data).enter().append('circle')
    .attr('cx',d=>x(d.label||'')).attr('cy',d=>y(d.value||0))
    .attr('r',3).attr('fill',color);
}

function renderPie(svg,data,w,h,m,opts){
  const radius=Math.min(w-m.left-m.right,h-m.top-m.bottom)/2;
  const g=svg.append('g').attr('transform',`translate(${w/2},${m.top+radius})`);

  const pie=d3.pie().value(d=>d.value||0).sort(null);
  const arc=d3.arc().innerRadius(radius*0.45).outerRadius(radius);

  g.selectAll('.arc').data(pie(data)).enter().append('path')
    .attr('d',arc)
    .attr('fill',(d,i)=>d.data.color||FALLBACK_COLORS[i%FALLBACK_COLORS.length])
    .attr('stroke','rgba(5,6,15,0.8)').attr('stroke-width',2);

  // Labels
  const labelArc=d3.arc().innerRadius(radius*0.75).outerRadius(radius*0.75);
  g.selectAll('.label').data(pie(data)).enter().append('text')
    .attr('transform',d=>`translate(${labelArc.centroid(d)})`)
    .attr('text-anchor','middle').attr('fill','#e0e0e0')
    .style('font-size','8px').text(d=>d.data.label||'');
}

function renderScatter(g,data,w,h,opts){
  const xExtent=d3.extent(data,d=>d.x??0);
  const yExtent=d3.extent(data,d=>d.y??0);
  const x=d3.scaleLinear().domain(xExtent).nice().range([0,w]);
  const y=d3.scaleLinear().domain(yExtent).nice().range([h,0]);

  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(5))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.append('g').call(d3.axisLeft(y).ticks(5))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.selectAll('.domain,.tick line').attr('stroke','#333');

  g.selectAll('.dot').data(data).enter().append('circle')
    .attr('cx',d=>x(d.x??0)).attr('cy',d=>y(d.y??0))
    .attr('r',4)
    .attr('fill',(d,i)=>d.color||FALLBACK_COLORS[i%FALLBACK_COLORS.length])
    .attr('opacity',0.7).attr('stroke','rgba(255,255,255,0.2)').attr('stroke-width',0.5);

  if(opts.x_label)g.append('text').attr('x',w/2).attr('y',h+32)
    .attr('text-anchor','middle').attr('fill','#666').style('font-size','8px').text(opts.x_label);
  if(opts.y_label)g.append('text').attr('transform','rotate(-90)')
    .attr('x',-h/2).attr('y',-32).attr('text-anchor','middle')
    .attr('fill','#666').style('font-size','8px').text(opts.y_label);
}

window.SignalCharts={render};

})();
