//-------------------------------------------------
//CONFIG
//-------------------------------------------------
const N        = 9;
const DB_MAX   = 20, DB_MIN = -20;
const Q_MIN    = 0.4, Q_MAX = 9.9;
const FREQ_MIN = 20,  FREQ_MAX = 20000;

const DEFAULT_GAIN      = 0;
const DEFAULT_FREQS     = [50,100,150,200,250,300,400,600,800];
const DEFAULT_Q         = 5.0;
const FULL_CHOICE_BANDS = new Set([0,7,8]);
const FILTER_TYPES      = ['Bell','Shelving','Low Pass','High Pass'];
const SHELVING_POL_FREQ = 1000;

//-------------------------------------------------
//THEME  — reads CSS custom properties at draw-time
//so a future theme-toggle only needs to swap :root vars
//-------------------------------------------------
function getTheme() {
	const s = getComputedStyle(document.documentElement);
	const v = name => s.getPropertyValue(name).trim();
	return {
		// Knobs
		accent:             v('--clr-accent'),
		accentBright:       v('--clr-accent-bright'),
		accentDim:          v('--clr-accent-dim'),
		knobTrack:          v('--clr-border-subtle'),
		knobValueLabel:     v('--clr-text-muted'),
		// EQ canvas — grid
		gridZero:           v('--clr-canvas-grid-zero'),
		gridNormal:         v('--clr-canvas-grid-normal'),
		gridLabel:          v('--clr-canvas-grid-label'),
		// EQ canvas — curves & fill
		bandCurve:          v('--clr-canvas-band-curve'),
		fillTop:            v('--clr-canvas-fill-top'),
		fillBot:            v('--clr-canvas-fill-bot'),
		bypassedFill:       v('--clr-canvas-bypassed'),
		bypassedStroke:     v('--clr-canvas-bypassed-stroke'),
		// EQ canvas — nodes
		nodeRingActive:     v('--clr-canvas-node-ring-active'),
		nodeRingInactive:   v('--clr-canvas-node-ring-inactive'),
		nodeDrag:           v('--clr-accent-bright'),
		nodeHover:          v('--clr-accent'),
		nodeDefault:        v('--clr-accent-dim'),
		nodeStroke:         v('--clr-accent-bright'),
		nodeLabel:          v('--clr-text-dark'),
	};
}

//-------------------------------------------------
//TMREQ TYPE MAP
//-------------------------------------------------
const TMREQ_TYPE_TO_NAME = { '0.00':'Bell', '1.00':'Shelving', '2.00':'Low Pass', '3.00':'High Pass' };
const TMREQ_NAME_TO_TYPE = { 'Bell':'0.00', 'Shelving':'1.00', 'Low Pass':'2.00', 'High Pass':'3.00' };

//-------------------------------------------------
//STATE
//-------------------------------------------------
let bands = Array.from({length:N}, (_,i) => ({
	gain:DEFAULT_GAIN, freq:DEFAULT_FREQS[i], q:DEFAULT_Q, type:'Bell'
}));
let bypassed  = false;
let delay     = 0.00;   // ms, 0.00–42.50
let volCal    = 0.00;   // dB, -24.0–3.0
let presets   = JSON.parse(localStorage.getItem('roomEq_presets') || '{}');

//-------------------------------------------------
//HELPERS
//-------------------------------------------------
function freqToNorm(f) {
	return (Math.log10(f)-Math.log10(FREQ_MIN)) /
	(Math.log10(FREQ_MAX)-Math.log10(FREQ_MIN));
}
function normToFreq(n) {
	return Math.pow(10, Math.log10(FREQ_MIN)+n*(Math.log10(FREQ_MAX)-Math.log10(FREQ_MIN)));
}
function formatFreq(f) {
	return f>=1000 ? (f/1000).toFixed(f%1000===0?0:1)+' kHz' : Math.round(f)+' Hz';
}
function clampParam(p,v) {
	if (p==='gain') return Math.max(DB_MIN,Math.min(DB_MAX,v));
	if (p==='freq') return Math.max(FREQ_MIN,Math.min(FREQ_MAX,v));
	if (p==='q')    return Math.max(Q_MIN,Math.min(Q_MAX,v));
}

//-------------------------------------------------
//BUILD DOM
//-------------------------------------------------
const container    = document.getElementById('bandsContainer');
const knobCanvases = [];
// Extra knobs: delay & volCal — built after bands
let extraKnobCanvases = {}; // key: 'delay' | 'volCal'

for (let i=0; i<N; i++) {
	const div=document.createElement('div');
	div.className='band'; div.id=`band-${i}`;

	const lbl=document.createElement('div');
	lbl.className='band-label'; lbl.textContent=`B${i+1}`;
	div.appendChild(lbl);

	[{key:'gain',label:'Gain'},{key:'freq',label:'Freq'},{key:'q',label:'Q'}].forEach(p=>{
		const wrap=document.createElement('div'); wrap.className='knob-wrap';
		const klbl=document.createElement('div'); klbl.className='knob-label'; klbl.textContent=p.label;
		const kc=document.createElement('canvas'); kc.className='knob';
		kc.width=38; kc.height=38;
		kc.dataset.band=i; kc.dataset.param=p.key;
		setupKnobEvents(kc,i,p.key);
		const kv=document.createElement('div'); kv.className='knob-value'; kv.id=`kv-${i}-${p.key}`;
		wrap.appendChild(klbl); wrap.appendChild(kc); wrap.appendChild(kv);
		div.appendChild(wrap);
		knobCanvases.push(kc);
	});

	if (FULL_CHOICE_BANDS.has(i)) {
		const sel=document.createElement('select'); sel.className='filter-select'; sel.id=`ftype-${i}`;
		FILTER_TYPES.forEach(t=>{
			const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o);
		});
		sel.value=bands[i].type;
		sel.addEventListener('change',()=>{ bands[i].type=sel.value; drawEQ(); });
		div.appendChild(sel);
	}
	container.appendChild(div);
}

//-------------------------------------------------
//BUILD EXTRA KNOBS (Delay & VolCal)
//-------------------------------------------------
function buildExtraKnob(key, label, containerEl) {
	const wrap = document.createElement('div'); wrap.className = 'knob-wrap';
	const klbl = document.createElement('div'); klbl.className = 'knob-label'; klbl.textContent = label;
	const kc   = document.createElement('canvas'); kc.className = 'knob';
	kc.width = 38; kc.height = 38;
	kc.dataset.extraParam = key;
	setupExtraKnobEvents(kc, key);
	const kv = document.createElement('div'); kv.className = 'knob-value'; kv.id = `kv-extra-${key}`;
	wrap.appendChild(klbl); wrap.appendChild(kc); wrap.appendChild(kv);
	containerEl.appendChild(wrap);
	extraKnobCanvases[key] = kc;
}

const extraKnobContainer = document.getElementById('extraKnobContainer');
buildExtraKnob('delay',  'Delay',  extraKnobContainer);
buildExtraKnob('volCal', 'VolCal', extraKnobContainer);

//-------------------------------------------------
//EXTRA KNOB DRAW (Delay & VolCal)
//-------------------------------------------------
function getExtraNorm(key) {
	if (key === 'delay')  return delay / 42.50;
	if (key === 'volCal') return (volCal - (-24.0)) / (3.0 - (-24.0));
	return 0;
}

function drawExtraKnob(key) {
	const kc = extraKnobCanvases[key];
	if (!kc) return;
	const c = kc.getContext('2d');
	const W = kc.width, H = kc.height, cx = W/2, cy = H/2, R = W/2-3;
	const norm   = getExtraNorm(key);
	const startA = Math.PI*0.75;
	const totalA = Math.PI*1.5;
	const angle  = startA + norm * totalA;
	const t      = getTheme();

	c.clearRect(0,0,W,H);

	// track
	c.beginPath(); c.arc(cx,cy,R,startA,startA+totalA);
	c.strokeStyle=t.knobTrack; c.lineWidth=3.5; c.stroke();

	// accent arc — unidirectional from startA
	if (norm > 0.005) {
		c.beginPath(); c.arc(cx,cy,R,startA,angle);
		c.strokeStyle=t.accent; c.lineWidth=3.5; c.stroke();
	}

	// pointer
	c.beginPath();
	c.moveTo(cx, cy);
	c.lineTo(cx+Math.cos(angle)*(R-1), cy+Math.sin(angle)*(R-1));
	c.strokeStyle=t.accentBright; c.lineWidth=2; c.stroke();

	// value label
	let txt = '';
	if (key === 'delay')  txt = delay.toFixed(2)+' ms';
	if (key === 'volCal') txt = (volCal>=0?'+':'')+volCal.toFixed(1)+' dB';
	const el = document.getElementById(`kv-extra-${key}`);
	if (el) { el.textContent = txt; el.style.color = t.knobValueLabel; }
}

function drawAllExtraKnobs() {
	drawExtraKnob('delay');
	drawExtraKnob('volCal');
}

//-------------------------------------------------
//KNOB DRAW (Bands)
//— grey track ring
//— orange filled arc from start to current value
//— orange pointer line (no center dot)
//-------------------------------------------------
function getNorm(bi,param) {
	const b=bands[bi];
	if (param==='gain') return (b.gain-DB_MIN)/(DB_MAX-DB_MIN);
	if (param==='freq') return freqToNorm(b.freq);
	if (param==='q')    return (b.q-Q_MIN)/(Q_MAX-Q_MIN);
	return 0;
}

function drawKnob(bi,param) {
	const kc=knobCanvases.find(c=>+c.dataset.band===bi&&c.dataset.param===param);
	if (!kc) return;
	const c=kc.getContext('2d');
	const W=kc.width, H=kc.height, cx=W/2, cy=H/2, R=W/2-3;
	const norm   = getNorm(bi,param);
	const startA = Math.PI*0.75;   // 135°
	const totalA = Math.PI*1.5;    // 270° sweep
	const angle  = startA+norm*totalA;
	const t      = getTheme();

	c.clearRect(0,0,W,H);

	// ── grey track (full arc) ──
	c.beginPath();
	c.arc(cx,cy,R,startA,startA+totalA);
	c.strokeStyle=t.knobTrack; c.lineWidth=3.5; c.stroke();

	// ── accent filled arc (value arc) ──
	// gain: bidirectional from center; freq & q: from startA
	if (param==='gain') {
		const centerA = startA + totalA*0.5; // 0 dB position
		const arcMin  = Math.min(centerA, angle);
		const arcMax  = Math.max(centerA, angle);
		if (arcMax-arcMin > 0.01) {
			c.beginPath();
			c.arc(cx,cy,R,arcMin,arcMax);
			c.strokeStyle=t.accent; c.lineWidth=3.5; c.stroke();
		}
	} else {
		if (norm > 0.005) {
			c.beginPath();
			c.arc(cx,cy,R,startA,angle);
			c.strokeStyle=t.accent; c.lineWidth=3.5; c.stroke();
		}
	}

	// ── pointer ──
	c.beginPath();
	c.moveTo(cx, cy);
	c.lineTo(cx+Math.cos(angle)*(R-1), cy+Math.sin(angle)*(R-1));
	c.strokeStyle=t.accentBright; c.lineWidth=2; c.stroke();

	// ── value label ──
	const b=bands[bi];
	let txt='';
	if (param==='gain') txt=(b.gain>=0?'+':'')+b.gain.toFixed(1)+' dB';
	if (param==='freq') txt=formatFreq(b.freq);
	if (param==='q')    txt=b.q.toFixed(2);
	const el=document.getElementById(`kv-${bi}-${param}`);
	if (el) { el.textContent=txt; el.style.color=t.knobValueLabel; }
}

function drawAllKnobs() {
	for (let i=0;i<N;i++) { drawKnob(i,'gain'); drawKnob(i,'freq'); drawKnob(i,'q'); }
	drawAllExtraKnobs();
}

//-------------------------------------------------
//KNOB INTERACTION
//-------------------------------------------------
let knobDrag=null;

function setupKnobEvents(kc,bi,param) {
	kc.addEventListener('mousedown',e=>{
		e.preventDefault();
		knobDrag={bi,param,startY:e.clientY,startVal:getBandVal(bi,param)};
		document.getElementById(`band-${bi}`).classList.add('active');
	});
	kc.addEventListener('dblclick',()=>{ setDefault(bi,param); drawKnob(bi,param); drawEQ(); });
	kc.addEventListener('wheel',e=>{ e.preventDefault(); nudge(bi,param,e.deltaY<0?1:-1); },{passive:false});
}

// Extra knob drag state
let extraKnobDrag = null; // {key, startY, startVal}

function setupExtraKnobEvents(kc, key) {
	kc.addEventListener('mousedown', e=>{
		e.preventDefault();
		const val = key==='delay' ? delay : volCal;
		extraKnobDrag = {key, startY:e.clientY, startVal:val};
	});
	kc.addEventListener('dblclick', ()=>{
		if (key==='delay')  delay  = 0.00;
		if (key==='volCal') volCal = 0.00;
		drawExtraKnob(key);
	});
	kc.addEventListener('wheel', e=>{
		e.preventDefault();
		const dir = e.deltaY < 0 ? 1 : -1;
		if (key==='delay')  delay  = Math.round(Math.max(0,   Math.min(42.50, delay  + dir*0.25))*100)/100;
		if (key==='volCal') volCal = Math.round(Math.max(-24.0,Math.min(3.0,  volCal + dir*0.1 ))*10)/10;
		drawExtraKnob(key);
		showTooltip(extraTooltipStr(key));
	},{passive:false});
}

function extraTooltipStr(key) {
	if (key==='delay')  return `Delay: ${delay.toFixed(2)} ms`;
	if (key==='volCal') return `Vol Cal: ${(volCal>=0?'+':'')+volCal.toFixed(1)} dB`;
	return '';
}

window.addEventListener('mousemove',e=>{
	if (extraKnobDrag) {
		const {key, startY, startVal} = extraKnobDrag;
		const dy = startY - e.clientY;
		if (key==='delay')  delay  = Math.round(Math.max(0,    Math.min(42.50, startVal + dy*(42.50/130)))*100)/100;
																							  if (key==='volCal') volCal = Math.round(Math.max(-24.0, Math.min(3.0,  startVal + dy*(27.0/130)))*10)/10;
																																													drawExtraKnob(key);
																																													showTooltip(extraTooltipStr(key));
																																													}
	if (!knobDrag) return;
	const {bi,param,startY,startVal}=knobDrag;
	const dy=startY-e.clientY;
	if (param==='freq') {
		let n=freqToNorm(startVal)+dy*0.003; n=Math.max(0,Math.min(1,n));
		bands[bi].freq=normToFreq(n);
	} else {
		const range=param==='gain'?(DB_MAX-DB_MIN):(Q_MAX-Q_MIN);
		let v=startVal+dy*(range/130);
		if (param==='gain') v=Math.round(v*10)/10;
		if (param==='q')    v=Math.round(v*100)/100;
		bands[bi][param]=clampParam(param,v);
	}
	drawKnob(bi,param); drawEQ();
	showTooltip(tooltipStr(bi,param));
});

window.addEventListener('mouseup',()=>{
	if (extraKnobDrag) { extraKnobDrag=null; hideTooltip(); }
	if (knobDrag) {
		document.getElementById(`band-${knobDrag.bi}`).classList.remove('active');
		knobDrag=null; hideTooltip();
	}
});

function getBandVal(i,p) { return p==='gain'?bands[i].gain:p==='freq'?bands[i].freq:bands[i].q; }

function nudge(i,p,dir) {
	if (p==='gain') bands[i].gain=clampParam('gain',Math.round((bands[i].gain+dir*0.5)*10)/10);
	if (p==='freq') { let n=freqToNorm(bands[i].freq)+dir*0.01; bands[i].freq=normToFreq(Math.max(0,Math.min(1,n))); }
	if (p==='q')    bands[i].q=clampParam('q',Math.round((bands[i].q+dir*0.1)*100)/100);
	drawKnob(i,p); drawEQ();
}

function setDefault(i,p) {
	if (p==='gain') bands[i].gain=DEFAULT_GAIN;
	if (p==='freq') bands[i].freq=DEFAULT_FREQS[i];
	if (p==='q')    bands[i].q=DEFAULT_Q;
}

//-------------------------------------------------
//TOOLTIP
//-------------------------------------------------
const tooltipEl=document.getElementById('tooltip');
function tooltipStr(i,p) {
	const b=bands[i];
	if (p==='gain') return `B${i+1} Gain: ${(b.gain>=0?'+':'')+b.gain.toFixed(1)} dB`;
	if (p==='freq') return `B${i+1} Freq: ${formatFreq(b.freq)}`;
	if (p==='q')    return `B${i+1} Q: ${b.q.toFixed(2)}`;
	return '';
}
function showTooltip(txt) { tooltipEl.textContent=txt; tooltipEl.style.display='block'; }
function hideTooltip()    { tooltipEl.style.display='none'; }
window.addEventListener('mousemove',e=>{
	tooltipEl.style.left=(e.clientX+14)+'px';
	tooltipEl.style.top =(e.clientY-20)+'px';
});

//-------------------------------------------------
//CANVAS / EQ DRAW
//-------------------------------------------------
const canvas=document.getElementById('eqCanvas');
const ctx   =canvas.getContext('2d');
let nodeDrag=null, hoveredNode=-1;

function resizeCanvas() { canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight; drawEQ(); }

function calcResponse(type,freq,gain,q,fArr) {
	const Fs=48000, f0=Math.max(20,Math.min(23000,freq));
	const w0=2*Math.PI*f0/Fs, cw=Math.cos(w0), sw=Math.sin(w0);
	const A=Math.pow(10,gain/40), aq=sw/(2*q);
					 let b0,b1,b2,a0,a1,a2;
					 switch(type) {
		case 'Bell':
			b0=1+aq*A;b1=-2*cw;b2=1-aq*A;a0=1+aq/A;a1=-2*cw;a2=1-aq/A; break;
		case 'Shelving': {
			const sqA=Math.sqrt(A),aqS=2*sqA*aq;
			if (freq<=SHELVING_POL_FREQ) {
				b0=A*((A+1)-(A-1)*cw+aqS);b1=2*A*((A-1)-(A+1)*cw);b2=A*((A+1)-(A-1)*cw-aqS);
				a0=(A+1)+(A-1)*cw+aqS;a1=-2*((A-1)+(A+1)*cw);a2=(A+1)+(A-1)*cw-aqS;
			} else {
				b0=A*((A+1)+(A-1)*cw+aqS);b1=-2*A*((A-1)+(A+1)*cw);b2=A*((A+1)+(A-1)*cw-aqS);
				a0=(A+1)-(A-1)*cw+aqS;a1=2*((A-1)-(A+1)*cw);a2=(A+1)-(A-1)*cw-aqS;
			}
			break; }
		case 'Low Pass':
			b0=(1-cw)/2;b1=1-cw;b2=(1-cw)/2;a0=1+aq;a1=-2*cw;a2=1-aq; break;
		case 'High Pass':
			b0=(1+cw)/2;b1=-(1+cw);b2=(1+cw)/2;a0=1+aq;a1=-2*cw;a2=1-aq; break;
		default: b0=1;b1=0;b2=0;a0=1;a1=0;a2=0;
	}
					 return fArr.map(f=>{
		const w=2*Math.PI*f/Fs, cosW=Math.cos(w);
		const rN=b0*b0+b1*b1+b2*b2+2*(b0*b1+b1*b2)*cosW+2*b0*b2*Math.cos(2*w);
		const rD=a0*a0+a1*a1+a2*a2+2*(a0*a1+a1*a2)*cosW+2*a0*a2*Math.cos(2*w);
		return 20*Math.log10(Math.max(1e-10,Math.sqrt(Math.max(0,rN/rD))));
	});
}

function drawEQ() {
	const W=canvas.width, H=canvas.height;
	const t=getTheme();
	ctx.clearRect(0,0,W,H);

	[-20,-15,-10,-5,0,5,10,15,20].forEach(db=>{
		const y=dbToY(db,H);
		ctx.strokeStyle=db===0?t.gridZero:t.gridNormal;
		ctx.lineWidth=db===0?1.5:1;
		ctx.setLineDash(db===0?[4,4]:[]);
		ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle=t.gridLabel;ctx.font='9px monospace';
		ctx.fillText((db>0?'+':'')+db,3,y-2);
	});
	[20,50,100,200,500,1000,2000,5000,10000,20000].forEach(f=>{
		const x=freqToX(f,W);
		ctx.strokeStyle=t.gridNormal;ctx.lineWidth=1;
		ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
		ctx.fillStyle=t.gridLabel;ctx.font='9px monospace';
		ctx.fillText(f>=1000?(f/1000)+'k':f,x+2,H-4);
	});

	const nPts=W;
	const fArr=Array.from({length:nPts},(_,i)=>normToFreq(i/(nPts-1)));
	let combined=new Array(nPts).fill(0);

	if (!bypassed) {
		bands.forEach((b,i)=>{
			const type=FULL_CHOICE_BANDS.has(i)?b.type:'Bell';
			const resp=calcResponse(type,b.freq,b.gain,b.q,fArr);
			ctx.beginPath();ctx.moveTo(0,dbToY(resp[0],H));
			for(let j=1;j<nPts;j++) ctx.lineTo(j,dbToY(resp[j],H));
			ctx.strokeStyle=t.bandCurve;ctx.lineWidth=1;ctx.stroke();
			resp.forEach((v,j)=>combined[j]+=v);
		});
	}

	const grad=ctx.createLinearGradient(0,0,0,H);
	grad.addColorStop(0,t.fillTop);
	grad.addColorStop(1,t.fillBot);
	ctx.beginPath();
	ctx.moveTo(0,dbToY(combined[0],H));
	for(let i=1;i<nPts;i++) ctx.lineTo(i,dbToY(combined[i],H));
	ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
	ctx.fillStyle=bypassed?t.bypassedFill:grad; ctx.fill();

	ctx.beginPath();
	ctx.moveTo(0,dbToY(combined[0],H));
	for(let i=1;i<nPts;i++) ctx.lineTo(i,dbToY(combined[i],H));
	ctx.strokeStyle=bypassed?t.bypassedStroke:t.accent;ctx.lineWidth=2;ctx.stroke();

	bands.forEach((b,i)=>{
		const x=freqToX(b.freq,W), y=dbToY(bypassed?0:b.gain,H);
		const isHov=hoveredNode===i, isDrg=nodeDrag&&nodeDrag.band===i;
		const qRad=8+(b.q-Q_MIN)/(Q_MAX-Q_MIN)*18;
		ctx.beginPath();ctx.arc(x,y,qRad,0,Math.PI*2);
		ctx.strokeStyle=isHov||isDrg?t.nodeRingActive:t.nodeRingInactive;
		ctx.lineWidth=1.5;ctx.stroke();
		ctx.beginPath();ctx.arc(x,y,isDrg?8:6,0,Math.PI*2);
		ctx.fillStyle=isDrg?t.nodeDrag:isHov?t.nodeHover:t.nodeDefault;
		ctx.fill();
		ctx.strokeStyle=t.nodeStroke;ctx.lineWidth=1.5;ctx.stroke();
		ctx.fillStyle=t.nodeLabel;ctx.font='bold 8px Arial';
		ctx.textAlign='center';ctx.textBaseline='middle';
		ctx.fillText(i+1,x,y);
		ctx.textAlign='left';ctx.textBaseline='alphabetic';
	});
}

function dbToY(db,H)  { return H*(1-(db-DB_MIN)/(DB_MAX-DB_MIN)); }
function freqToX(f,W) { return W*freqToNorm(f); }

function getNodeAt(mx,my) {
	const W=canvas.width,H=canvas.height;
	for(let i=N-1;i>=0;i--)
		if(Math.hypot(mx-freqToX(bands[i].freq,W),my-dbToY(bands[i].gain,H))<14) return i;
	return -1;
}

canvas.addEventListener('mousemove',e=>{
	const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
	if (nodeDrag) {
		const {band,sx,sy,sf,sg}=nodeDrag,W=canvas.width,H=canvas.height;
		let fn=freqToNorm(sf)+(mx-sx)/(W*0.7); fn=Math.max(0,Math.min(1,fn));
		bands[band].freq=normToFreq(fn);
		let gain=sg-(my-sy)*((DB_MAX-DB_MIN)/H)*1.5;
		gain=Math.round(Math.max(DB_MIN,Math.min(DB_MAX,gain))*10)/10;
		bands[band].gain=gain;
		drawKnob(band,'gain');drawKnob(band,'freq');drawEQ();
		showTooltip(`B${band+1}  ${formatFreq(bands[band].freq)}  ${(gain>=0?'+':'')+gain.toFixed(1)} dB  Q:${bands[band].q.toFixed(2)}`);
		canvas.style.cursor='grabbing'; return;
	}
	const hit=getNodeAt(mx,my);
	if(hit!==hoveredNode){hoveredNode=hit;drawEQ();}
	canvas.style.cursor=hit>=0?'grab':'crosshair';
	if(hit>=0) showTooltip(`B${hit+1}  ${formatFreq(bands[hit].freq)}  ${(bands[hit].gain>=0?'+':'')+bands[hit].gain.toFixed(1)} dB  Q:${bands[hit].q.toFixed(2)}`);
	else hideTooltip();
});
canvas.addEventListener('mousedown',e=>{
	const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
	const hit=getNodeAt(mx,my);
	if(hit>=0){
		nodeDrag={band:hit,sx:mx,sy:my,sf:bands[hit].freq,sg:bands[hit].gain};
		document.getElementById(`band-${hit}`).classList.add('active');
		e.preventDefault();
	}
});
window.addEventListener('mouseup',()=>{
	if(nodeDrag){
		document.getElementById(`band-${nodeDrag.band}`).classList.remove('active');
		nodeDrag=null;hideTooltip();canvas.style.cursor='crosshair';
	}
});
canvas.addEventListener('wheel',e=>{
	e.preventDefault();
	const r=canvas.getBoundingClientRect();
	const hit=getNodeAt(e.clientX-r.left,e.clientY-r.top);
	if(hit<0)return;
	bands[hit].q=Math.round(Math.max(Q_MIN,Math.min(Q_MAX,bands[hit].q+(e.deltaY<0?1:-1)*0.2))*100)/100;
	drawKnob(hit,'q');drawEQ();
	showTooltip(`B${hit+1} Q: ${bands[hit].q.toFixed(2)}`);
},{passive:false});

let tN=-1,tSX=0,tSY=0,tSF=0,tSG=0;
canvas.addEventListener('touchstart',e=>{
	const r=canvas.getBoundingClientRect(),t=e.touches[0];
	tN=getNodeAt(t.clientX-r.left,t.clientY-r.top);
	if(tN>=0){tSX=t.clientX-r.left;tSY=t.clientY-r.top;tSF=bands[tN].freq;tSG=bands[tN].gain;}
},{passive:true});
canvas.addEventListener('touchmove',e=>{
	if(tN<0)return;
	const r=canvas.getBoundingClientRect(),t=e.touches[0];
	const mx=t.clientX-r.left,my=t.clientY-r.top,W=canvas.width,H=canvas.height;
	let fn=freqToNorm(tSF)+(mx-tSX)/(W*0.7);fn=Math.max(0,Math.min(1,fn));
	bands[tN].freq=normToFreq(fn);
	let gain=tSG-(my-tSY)*((DB_MAX-DB_MIN)/H)*1.5;
	gain=Math.round(Math.max(DB_MIN,Math.min(DB_MAX,gain))*10)/10;
	bands[tN].gain=gain;
	drawKnob(tN,'gain');drawKnob(tN,'freq');drawEQ();
},{passive:true});
canvas.addEventListener('touchend',()=>{tN=-1;});

//-------------------------------------------------
//PRESETS
//-------------------------------------------------
const presetSelect=document.getElementById('presetSelect');

function refreshPresets(){
	presetSelect.innerHTML='<option value="">— Preset —</option>';
	Object.keys(presets).forEach(n=>{
		const o=document.createElement('option');
		o.value=n;
		o.textContent=n;
		presetSelect.appendChild(o);
	});
}
function savePreset(){
	const name=document.getElementById('presetName').value.trim();
	if(!name){alert('Preset Name cannot be empty!');return;}
	presets[name]=bands.map(b=>({...b}));
	localStorage.setItem('roomEq_presets',JSON.stringify(presets));
	refreshPresets();presetSelect.value=name;
}
function deletePreset(){
	const n=presetSelect.value;
	if(!n){alert('No Preset selected');return;}
	if(!confirm(`Delete "${n}"?`))return;
	delete presets[n];
	localStorage.setItem('roomEq_presets',JSON.stringify(presets));
	refreshPresets();
}
presetSelect.addEventListener('change',()=>{
	const n=presetSelect.value;
	if(!n||!presets[n])return;
	presets[n].forEach((src,i)=>Object.assign(bands[i],src));
	FULL_CHOICE_BANDS.forEach(i=>{const s=document.getElementById(`ftype-${i}`);
		if(s)s.value=bands[i].type;});
	drawAllKnobs();
	drawEQ();
	notifyOSC_fullState();
});

//-------------------------------------------------
//RESET / BYPASS
//-------------------------------------------------
function resetEQ(){
	bands.forEach((b,i)=>{b.gain=DEFAULT_GAIN;b.freq=DEFAULT_FREQS[i];b.q=DEFAULT_Q;b.type='Bell';});
	FULL_CHOICE_BANDS.forEach(i=>{const s=document.getElementById(`ftype-${i}`);if(s)s.value='Bell';});
	delay=0.00; volCal=0.00;
	drawAllKnobs();
	drawEQ();
	notifyOSC_fullState();
}

function updateBypassBtn(){
	const btn=document.getElementById('bypassBtn');
	if (!bypassed) {
		// EQ is active - show "On" with orange background
		btn.className='bypass-btn state-on';
		btn.textContent='On';
	} else {
		// EQ is bypassed - show "Off" dim
		btn.className='bypass-btn state-off';
		btn.textContent='Off';
	}
}

function toggleBypass(){
	bypassed=!bypassed;
	updateBypassBtn();
	drawEQ();
}

//-------------------------------------------------
//JSON EXPORT / IMPORT
//-------------------------------------------------
function exportJSON(){
	const data={
		preset:document.getElementById('presetName').value.trim()||'untitled',
		bypassed,
		delay,
		volCal,
		bands:bands.map((b,i)=>({
			band:i+1,
			type:FULL_CHOICE_BANDS.has(i)?b.type:'Bell',
			freq_hz:Math.round(b.freq),
			gain_db:b.gain,
			q:b.q
		}))
	};
	const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
	const url=URL.createObjectURL(blob);
	const a=document.createElement('a');a.href=url;
	a.download=(data.preset||'eq-settings')+'.json';a.click();
	URL.revokeObjectURL(url);
}

function importJSON(event){
	const file=event.target.files[0];if(!file)return;
	const reader=new FileReader();
	reader.onload=e=>{
		try {
			const data=JSON.parse(e.target.result);
			if(!data.bands||data.bands.length!==N){
				alert('Invalid RoomEQ-File Format in json.');
				return;
			}
			data.bands.forEach((src,i)=>{
				bands[i].gain=clampParam('gain',src.gain_db??DEFAULT_GAIN);
				bands[i].freq=clampParam('freq',src.freq_hz??DEFAULT_FREQS[i]);
				bands[i].q=clampParam('q',src.q??DEFAULT_Q);
				bands[i].type=FILTER_TYPES.includes(src.type)?src.type:'Bell';
			});
			if(data.preset)document.getElementById('presetName').value=data.preset;
			bypassed=data.bypassed??false;
			delay  = typeof data.delay  ==='number' ? Math.max(0,   Math.min(42.50, data.delay))  : 0.00;
			volCal = typeof data.volCal ==='number' ? Math.max(-24.0,Math.min(3.0,  data.volCal)) : 0.00;
			updateBypassBtn();
			FULL_CHOICE_BANDS.forEach(i=>{const s=document.getElementById(`ftype-${i}`);if(s)s.value=bands[i].type;});
			drawAllKnobs();
			drawEQ();
			notifyOSC_fullState();
		} catch(err){alert('File Read Error: '+err.message);}
	};
	reader.readAsText(file);
	event.target.value='';
}

//-------------------------------------------------
//TMREQ EXPORT / IMPORT
//-------------------------------------------------

function buildTmreqChannel(channelName) {
	const lines = [];
	lines.push(`\t<${channelName}>`);
	lines.push(`\t\t<Params>`);
	lines.push(`\t\t\t<val e="REQ Delay" v="${delay.toFixed(2)},"/>`);
	for (let i=0; i<N; i++) {
		const b = bands[i];
		const n = i+1;
		lines.push(`\t\t\t<val e="REQ Band${n} Freq" v="${b.freq.toFixed(2)},"/>`);
		lines.push(`\t\t\t<val e="REQ Band${n} Q" v="${b.q.toFixed(2)},"/>`);
		lines.push(`\t\t\t<val e="REQ Band${n} Gain" v="${b.gain.toFixed(2)},"/>`);
	}
	// Only write type entries for FULL_CHOICE_BANDS.
	// TotalMix quirk: Band1 uses "REQ Band1Type" (no space), all others use "REQ Band{n} Type".
	FULL_CHOICE_BANDS.forEach(i=>{
		const n       = i+1;
		const typeVal = TMREQ_NAME_TO_TYPE[bands[i].type] ?? '0.00';
		const eName   = n===1 ? `REQ Band1Type` : `REQ Band${n} Type`;
		lines.push(`\t\t\t<val e="${eName}" v="${typeVal},"/>`);
	});
	lines.push(`\t\t\t<val e="Chan Gain" v="${volCal.toFixed(2)},"/>`);
	lines.push(`\t\t</Params>`);
	lines.push(`\t</${channelName}>`);
	return lines.join('\n');
}

function exportTmreq() {
	const presetName = document.getElementById('presetName').value.trim() || 'untitled';
	const xml = [
		'<Preset>',
		buildTmreqChannel('Room EQ L'),
		buildTmreqChannel('Room EQ R'),
		'</Preset>'
	].join('\n');
	const blob = new Blob([xml], {type:'application/xml'});
	const url  = URL.createObjectURL(blob);
	const a    = document.createElement('a');
	a.href = url; a.download = presetName+'.tmreq'; a.click();
	URL.revokeObjectURL(url);
}

function parseTmreqChannel(channelText) {
	const result = { bands:Array.from({length:N},(_,i)=>({
		freq: DEFAULT_FREQS[i], q: DEFAULT_Q, gain: DEFAULT_GAIN, type: 'Bell'
	})), delay:0.00, volCal:0.00 };

	// Extract all <val e="..." v="..."/> entries from the channel block
	const valRe = /<val\s+e="([^"]+)"\s+v="([^"]+)"/g;
	let m;
	while ((m = valRe.exec(channelText)) !== null) {
		const e  = m[1];
		const v  = parseFloat(m[2]); // trailing comma is handled by parseFloat
		if (e === 'REQ Delay')  { result.delay  = v; continue; }
		if (e === 'Chan Gain')  { result.volCal = v; continue; }

		// Band1Type quirk: no space between band number and "Type"
		const mType1 = e.match(/^REQ Band(\d+)Type$/);
		if (mType1) {
			const idx = parseInt(mType1[1])-1;
			if (idx>=0 && idx<N && FULL_CHOICE_BANDS.has(idx)) {
				const typeName = TMREQ_TYPE_TO_NAME[v.toFixed(2)];
				if (typeName) result.bands[idx].type = typeName;
			}
			continue;
		}

		// Normal band params: "REQ Band{n} Freq/Q/Gain/Type"
		const mBand = e.match(/^REQ Band(\d+) (Freq|Q|Gain|Type)$/);
		if (!mBand) continue;
		const idx  = parseInt(mBand[1])-1;
		const prop = mBand[2];
		if (idx<0 || idx>=N) continue;
		if (prop==='Freq')  result.bands[idx].freq = v;
		if (prop==='Q')     result.bands[idx].q    = v;
		if (prop==='Gain')  result.bands[idx].gain  = v;
		if (prop==='Type' && FULL_CHOICE_BANDS.has(idx)) {
			const typeName = TMREQ_TYPE_TO_NAME[v.toFixed(2)];
			if (typeName) result.bands[idx].type = typeName;
		}
	}
	return result;
}

function applyTmreqData(data) {
	data.bands.forEach((src,i)=>{
		bands[i].freq = clampParam('freq', src.freq);
		bands[i].q    = clampParam('q',    src.q);
		bands[i].gain = clampParam('gain', src.gain);
		if (FULL_CHOICE_BANDS.has(i)) bands[i].type = src.type;
	});
	delay  = Math.max(0,     Math.min(42.50, data.delay));
	volCal = Math.max(-24.0, Math.min(3.0,   data.volCal));
	FULL_CHOICE_BANDS.forEach(i=>{
		const s=document.getElementById(`ftype-${i}`); if(s) s.value=bands[i].type;
	});
	drawAllKnobs();
	drawEQ();
	notifyOSC_fullState();
}

function importTmreq(event) {
	const file = event.target.files[0]; if(!file) return;
	const reader = new FileReader();
	reader.onload = e=>{
		try {
			const text = e.target.result;

			// Split into channel blocks by finding top-level children of <Preset>
			// Tag names may contain spaces, so we can't use DOMParser.
			// Strategy: find all opening tags directly inside <Preset> and extract their blocks.
			const presetMatch = text.match(/<Preset>([\s\S]*)<\/Preset>/);
			if (!presetMatch) { alert('Invalid .tmreq file: no <Preset> found.'); return; }

			const inner   = presetMatch[1];
			// Find all channel tag names (first word after <, allowing spaces in name)
			const tagRe   = /<([^/][^>]*)>/g;
			const channels = [];
			let tm;
			while ((tm = tagRe.exec(inner)) !== null) {
				const tagName = tm[1].trim();
				// Only direct children — skip <Params> and <val ...
				if (tagName==='Params' || tagName.startsWith('val')) continue;
				// Extract the block for this channel
				const open  = `<${tagName}>`;
				const close = `</${tagName}>`;
				const start = inner.indexOf(open);
				const end   = inner.indexOf(close);
				if (start===-1 || end===-1) continue;
				channels.push({ name: tagName, text: inner.slice(start, end+close.length) });
			}

			if (channels.length === 0) { alert('No channels found in .tmreq file.'); return; }

			if (channels.length === 1) {
				applyTmreqData(parseTmreqChannel(channels[0].text));
				return;
			}

			// Multiple channels — let user choose
			const names  = channels.map(ch=>ch.name);
			const choice = prompt(
								  `Found ${names.length} channels:\n${names.map((n,i)=>`  ${i+1}. ${n}`).join('\n')}\n\nEnter channel number to import:`
								  );
			if (choice === null) return;
			const idx = parseInt(choice)-1;
			if (isNaN(idx)||idx<0||idx>=channels.length) { alert('Invalid selection.'); return; }
			applyTmreqData(parseTmreqChannel(channels[idx].text));

		} catch(err){ alert('File Read Error: '+err.message); }
	};
	reader.readAsText(file);
	event.target.value='';
}

const OSC_TYPE_TO_NAME = { 0:'Bell', 1:'Shelving', 2:'Low Pass', 3:'High Pass' };
const OSC_NAME_TO_TYPE = { 'Bell':0, 'Shelving':1, 'Low Pass':2, 'High Pass':3 };

// Channel identifier parsed from URL: e.g. "output/1"
const urlParams  = new URLSearchParams(window.location.search);
const oscChannel = urlParams.get('channel') || null; // e.g. "output/1"

// ── Outbound: send a value change to opener via postMessage ──
function oscSend(addr, value) {
	if (!window.opener || window.opener.closed) return;
	window.opener.postMessage({ type: 'ROOMEQ_OSC_SEND', addr, value }, '*');
}

// Helper — build full OSC address for this channel
function oscAddr(sub) {
	return oscChannel ? `/${oscChannel}/${sub}` : null;
}

// ── Called by UI interactions to notify oscmix ──
// Wraps all user-triggered changes; called after state is already updated.
function notifyOSC_band(bandIdx, param) {
	const addr = oscAddr(`roomeq/band${bandIdx+1}${param}`);
	if (!addr) return;
	const b = bands[bandIdx];
	let value;
	if (param === 'gain') value = b.gain;
	if (param === 'freq') value = b.freq;
	if (param === 'q')    value = b.q;
	if (param === 'type') {
		// Only FULL_CHOICE_BANDS have a type OSC address
		if (!FULL_CHOICE_BANDS.has(bandIdx)) return;
		value = OSC_NAME_TO_TYPE[b.type] ?? 0;
	}
	oscSend(addr, value);
}

function notifyOSC_delay() {
	const addr = oscAddr('roomeq/delay');
	if (!addr) return;
	oscSend(addr, delay / 10); // internal ms -> OSC ÷10
}

function notifyOSC_volCal() {
	const addr = oscAddr('volumecal');
	if (!addr) return;
	oscSend(addr, volCal);
}

function notifyOSC_bypass() {
	const addr = oscAddr('roomeq');
	if (!addr) return;
	// oscmix: roomeq=1 means enabled (not bypassed)
	oscSend(addr, bypassed ? 0 : 1);
}

// Sends the complete current state to the device.
// Used after preset load, JSON/tmreq import, and reset.
function notifyOSC_fullState() {
	for (let i = 0; i < N; i++) {
		notifyOSC_band(i, 'gain');
		notifyOSC_band(i, 'freq');
		notifyOSC_band(i, 'q');
		if (FULL_CHOICE_BANDS.has(i)) notifyOSC_band(i, 'type');
	}
	notifyOSC_delay();
	notifyOSC_volCal();
	notifyOSC_bypass();
}

// Patch existing interaction points to fire OSC notifications ──
// We wrap the functions that already exist, calling notify after state update.

// Band knob drag end -> notify on mouseup
const _origMouseup = window.onmouseup;
window.addEventListener('mouseup', () => {
	if (knobDrag) {
		notifyOSC_band(knobDrag.bi, knobDrag.param);
	}
	if (extraKnobDrag) {
		if (extraKnobDrag.key === 'delay')  notifyOSC_delay();
		if (extraKnobDrag.key === 'volCal') notifyOSC_volCal();
	}
});

// Canvas node drag end -> gain + freq
const _origCanvasMouseup = canvas.onmouseup;
window.addEventListener('mouseup', () => {
	if (nodeDrag) {
		notifyOSC_band(nodeDrag.band, 'gain');
		notifyOSC_band(nodeDrag.band, 'freq');
	}
});

// Canvas wheel -> Q
canvas.addEventListener('wheel', () => {
	const r   = canvas.getBoundingClientRect();
	const hit = getNodeAt(event.clientX - r.left, event.clientY - r.top);
	if (hit >= 0) notifyOSC_band(hit, 'q');
}, { passive: true, capture: true });

// Knob wheel nudge -> already fires nudge(), patch nudge to notify
const _origNudge = nudge;
window.nudge = function(i, p, dir) {
	_origNudge(i, p, dir);
	notifyOSC_band(i, p);
};

// Knob dblclick reset -> patch setDefault
const _origSetDefault = setDefault;
window.setDefault = function(i, p) {
	_origSetDefault(i, p);
	notifyOSC_band(i, p);
};

// Filter type select changes
FULL_CHOICE_BANDS.forEach(i => {
	const sel = document.getElementById(`ftype-${i}`);
	if (sel) sel.addEventListener('change', () => notifyOSC_band(i, 'type'));
});

// Extra knob wheel — already fires drawExtraKnob, patch wheel handler
// (delay & volCal wheel events are defined inline in setupExtraKnobEvents,
//we hook via the existing wheel listener capture phase)
const _extraKnobWheelNotify = (e) => {
	const key = e.target?.dataset?.extraParam;
	if (key === 'delay')  notifyOSC_delay();
	if (key === 'volCal') notifyOSC_volCal();
};
document.querySelectorAll('canvas.knob[data-extra-param]').forEach(kc => {
	kc.addEventListener('wheel', _extraKnobWheelNotify, { passive: true });
});

// Bypass toggle
const _origToggleBypass = toggleBypass;
window.toggleBypass = function() {
	_origToggleBypass();
	notifyOSC_bypass();
};

// ── Inbound: receive OSC values from oscmix opener ──
// Message format: { type:'ROOMEQ_OSC_RECV', addr:'/output/1/roomeq/band1gain', value:3.5 }
window.addEventListener('message', (e) => {
	if (!e.data || e.data.type !== 'ROOMEQ_OSC_RECV') return;
	const { addr, value } = e.data;

	// Strip channel prefix to get the roomeq sub-address
	const prefix = oscChannel ? `/${oscChannel}/` : null;
	const sub = prefix && addr.startsWith(prefix) ? addr.slice(prefix.length) : addr;

	// roomeq bypass
	if (sub === 'roomeq') {
		bypassed = value === 0;
		updateBypassBtn();
		drawEQ();
		return;
	}

	// roomeq/delay
	if (sub === 'roomeq/delay') {
		delay = Math.max(0, Math.min(42.50, value * 10)); // OSC ×10 -> internal ms
		drawExtraKnob('delay');
		return;
	}

	// volumecal
	if (sub === 'volumecal') {
		volCal = Math.max(-24.0, Math.min(3.0, value));
		drawExtraKnob('volCal');
		return;
	}

	// roomeq/band{n}gain|freq|q|type
	const mBand = sub.match(/^roomeq\/band(\d+)(gain|freq|q|type)$/);
	if (mBand) {
		const bi   = parseInt(mBand[1]) - 1;
		const prop = mBand[2];
		if (bi < 0 || bi >= N) return;
		if (prop === 'gain') { bands[bi].gain = clampParam('gain', value); drawKnob(bi,'gain'); drawEQ(); }
		if (prop === 'freq') { bands[bi].freq = clampParam('freq', value); drawKnob(bi,'freq'); drawEQ(); }
		if (prop === 'q')    { bands[bi].q    = clampParam('q',    value); drawKnob(bi,'q');    drawEQ(); }
		if (prop === 'type' && FULL_CHOICE_BANDS.has(bi)) {
			const name = OSC_TYPE_TO_NAME[Math.round(value)];
			if (name) {
				bands[bi].type = name;
				const sel = document.getElementById(`ftype-${bi}`);
				if (sel) sel.value = name;
				drawEQ();
			}
		}
	}
});

// ── Update window title with channel info ──
if (oscChannel) {
	document.title = `Room EQ — ${oscChannel}`;
	const h1 = document.querySelector('h1');
	if (h1) h1.textContent = `Room EQ [${oscChannel}] v.0.0.1`;
}

//-------------------------------------------------
//INIT
//-------------------------------------------------
refreshPresets();
window.addEventListener('resize',resizeCanvas);
resizeCanvas();
drawAllKnobs();
updateBypassBtn();
