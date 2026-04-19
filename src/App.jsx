
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label, AreaChart, Area } from 'recharts';
import { Microscope, Clock, Play, Pause, RefreshCw, AlertTriangle, Waves, Target, BarChart3 } from 'lucide-react';

// 主要模擬組件
const App = () => {
  // --- 狀態設定 ---
  const [isRunning, setIsRunning] = useState(false);
  const [ddtContamination, setDdtContamination] = useState(0.5); 
  const [ticks, setTicks] = useState(0);
  const [history, setHistory] = useState([]);
  const [targetYear, setTargetYear] = useState(50); 

  const TICKS_PER_YEAR = 60;
  const currentYear = Math.floor(ticks / TICKS_PER_YEAR);

  const [entities, setEntities] = useState([]);
  const requestRef = useRef();
  const canvasRef = useRef(null);

  // --- 生物定義 (嚴格校準 1/10 定則) ---
  const SPECIES = {
    PPLANKTON: { label: '浮游藻類', color: '#22c55e', size: 4, count: 280, type: 'pp', weight: 1.0 },
    ZPLANKTON: { label: '浮游動物', color: '#eab308', size: 7, count: 100, type: 'zp', weight: 0.15 },
    SMELT: { label: '胡瓜魚', color: '#3b82f6', size: 12, count: 55, type: 'smelt', weight: 0.02 },
    SALMON: { label: '鮭魚', color: '#ef4444', size: 20, count: 14, type: 'salmon', weight: 0.003 },
    PELICAN: { label: '鵜鶘', color: '#64748b', size: 30, count: 5, type: 'pelican', weight: 0.0005 }
  };

  const canvasSize = 400;
  const waterLevel = 260; // 水深高度 (上方空間給鵜鶘)

  // --- 初始化功能 ---
  const initSimulation = () => {
    const newEntities = [];
    Object.entries(SPECIES).forEach(([key, spec]) => {
      for (let i = 0; i < spec.count; i++) {
        const isPelican = spec.type === 'pelican';
        newEntities.push({
          id: ${spec.type}-${i},
          type: spec.type,
          x: Math.random() * canvasSize,
          // 鵜鶘在天空，其他在水裡
          y: isPelican ? (waterLevel + 20 + Math.random() * 100) : (Math.random() * waterLevel),
          energy: Math.random() * 500 + 400,
          ddt: 0,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 0.8
        });
      }
    });
    setEntities(newEntities);
    setTicks(0);
    setHistory([]);
    setIsRunning(false);
  };

  useEffect(() => {
    initSimulation();
  }, []);

  // --- 自動停止邏輯 ---
  useEffect(() => {
    if (currentYear >= targetYear && isRunning) {
      setIsRunning(false);
    }
  }, [currentYear, targetYear, isRunning]);

  // --- 繪圖邏輯 (擬真鵜鶘) ---
  const drawEntity = (ctx, e) => {
    const { x, y, vx, type, ddt } = e;
    const canvasY = canvasSize - y;
    const spec = Object.values(SPECIES).find(s => s.type === type);
    const isRight = vx > 0;
    
    ctx.save();
    ctx.translate(x, canvasY);
    if (!isRight) ctx.scale(-1, 1);
    ctx.fillStyle = spec.color;
    ctx.strokeStyle = spec.color;
    
    if (ddt > 40) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "red";
    }

    switch(type) {
      case 'pp': // 藻類
        ctx.beginPath();
        for(let i=0; i<5; i++) { ctx.rotate(Math.PI*2/5); ctx.lineTo(spec.size, 0); ctx.lineTo(spec.size/2, spec.size/2); }
        ctx.fill();
        break;
      case 'zp': // 浮游動物
        ctx.beginPath(); ctx.ellipse(0, 0, spec.size, spec.size/1.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(spec.size/2, -spec.size/2); ctx.lineTo(spec.size, -spec.size); ctx.stroke();
        break;
      case 'smelt':
      case 'salmon': // 魚類
        const s = type === 'smelt' ? 1 : 1.6;
        ctx.beginPath(); ctx.moveTo(8*s, 0); ctx.quadraticCurveTo(0, -6*s, -8*s, 0); ctx.quadraticCurveTo(0, 6*s, 8*s, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6*s, 0); ctx.lineTo(-11*s, -5*s); ctx.lineTo(-11*s, 5*s); ctx.closePath(); ctx.fill();
        break;
      case 'pelican': // 擬真鵜鶘
        // 身體
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // 頸部
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(10, -5);
        ctx.quadraticCurveTo(18, -12, 12, -22);
        ctx.stroke();
        // 帶喉囊的大喙 (黃色)
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.moveTo(12, -22);
        ctx.lineTo(30, -18);
        ctx.quadraticCurveTo(18, -6, 10, -16);
        ctx.closePath();
        ctx.fill();
        // 翅膀
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, -2);
        ctx.lineTo(-20, -15);
        ctx.lineTo(-10, -2);
        ctx.stroke();
        break;
    }
    ctx.restore();
  };

  // --- 核心更新循環 ---
  const update = () => {
    if (!isRunning || currentYear >= targetYear) return;

    setEntities(prev => {
      let next = [...prev];
      // 1. 移動
      next = next.map(e => {
        let { x, y, vx, vy, type } = e;
        x += vx; y += vy;
        if (x < 0 || x > canvasSize) vx *= -1;
        if (type !== 'pelican') {
          if (y < 0 || y > waterLevel) vy *= -1;
        } else {
          if (y < waterLevel - 20 || y > canvasSize - 5) vy *= -1;
        }
        return { ...e, x, y, vx, vy };
      });

      // 2. 交互與 DDT 邏輯
      return next.map((e) => {
        let { type, energy, ddt, x, y } = e;
        // 代謝清除機制：模擬毒素隨時間排除
        const metabolicClearance = 0.9995; 
        ddt *= metabolicClearance;

        if (type === 'pp') {
          if (Math.random() < 0.1) {
            energy += 1.5;
            ddt += ddtContamination * 0.08; 
          }
          if (energy > 800) { energy = 400; ddt *= 0.6; } 
        } else {
          // 掠食檢測
          const preyType = type === 'zp' ? 'pp' : (type === 'smelt' ? 'zp' : (type === 'salmon' ? 'smelt' : 'salmon'));
          const radius = type === 'pelican' ? 70 : 25;
          const preyIdx = next.findIndex(p => p.type === preyType && Math.sqrt(Math.pow(p.x-x, 2) + Math.pow(p.y-y, 2)) < radius);
          
          if (preyIdx !== -1) {
            ddt += next[preyIdx].ddt; 
            energy += 120;
            // 獵物重置為 0 DDT (模擬新生個體，確保 Q4 邏輯成立)
            next[preyIdx] = { 
              ...next[preyIdx], 
              ddt: 0, 
              energy: 400, 
              x: Math.random() * canvasSize, 
              y: (preyType === 'pelican' ? waterLevel + 30 : Math.random() * waterLevel) 
            };
          }
          energy -= 1.5; 
          const maxEnergy = type === 'pelican' ? 40000 : (type === 'salmon' ? 20000 : 10000);
          if (energy > maxEnergy) { energy = maxEnergy * 0.5; ddt *= 0.65; }
          if (energy < 0) { energy = 500; ddt = 0; }
        }
        return { ...e, energy, ddt };
      });
    });
    setTicks(t => t + 1);
  };

  // --- 數據紀錄 ---
  useEffect(() => {
    if (ticks % (TICKS_PER_YEAR / 2) === 0 && entities.length > 0) {
      const getAvgDDT = (t) => {
        const g = entities.filter(e => e.type === t);
        return g.length > 0 ? (g.reduce((a, c) => a + c.ddt, 0) / g.length).toFixed(2) : 0;
      };
      const getTotalBiomass = (t) => {
        const g = entities.filter(e => e.type === t);
        const spec = Object.values(SPECIES).find(s => s.type === t);
        return g.length > 0 ? Math.floor(g.reduce((a, c) => a + c.energy, 0) * spec.weight / 15) : 0;
      };
      setHistory(prev => [...prev, {
        year: currentYear,
        '藻類濃度': parseFloat(getAvgDDT('pp')),
        '動物濃度': parseFloat(getAvgDDT('zp')),
        '胡瓜魚濃度': parseFloat(getAvgDDT('smelt')),
        '鮭魚濃度': parseFloat(getAvgDDT('salmon')),
        '鵜鶘濃度': parseFloat(getAvgDDT('pelican')),
        '浮游藻類量': getTotalBiomass('pp'),
        '浮游動物量': getTotalBiomass('zp'),
        '胡瓜魚量': getTotalBiomass('smelt'),
        '鮭魚量': getTotalBiomass('salmon'),
        '鵜鶘量': getTotalBiomass('pelican'),
      }]);
    }
  }, [ticks]);

  // --- Canvas 渲染 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    // 背景
    ctx.fillStyle = '#f0f9ff'; ctx.fillRect(0, 0, canvasSize, canvasSize); 
    ctx.fillStyle = '#bae6fd'; ctx.fillRect(0, canvasSize - waterLevel, canvasSize, waterLevel); 
    
    // 水面線
    ctx.beginPath(); ctx.moveTo(0, canvasSize - waterLevel); ctx.lineTo(canvasSize, canvasSize - waterLevel);
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 1.5; ctx.stroke();
    
    entities.forEach(e => drawEntity(ctx, e));
    if (isRunning && currentYear < targetYear) requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [entities, isRunning, targetYear]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 p-4 font-sans text-slate-900 overflow-x-hidden">
      <header className="mb-4 flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Microscope className="text-emerald-500" size={24} /> 生態毒素觀測站
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
            <span className={px-2 py-0.5 rounded-full ${currentYear >= targetYear ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-blue-50 text-blue-600'}}>
              <Clock size={12} className="inline mr-1"/> 第 {currentYear} 年 / 目標 {targetYear} 年
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={currentYear >= targetYear && !isRunning}
            onClick={() => setIsRunning(!isRunning)}
            className={flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-sm text-sm ${currentYear >= targetYear && !isRunning ? 'bg-slate-300 text-slate-500' : isRunning ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />} {isRunning ? '暫停' : '開始'}
          </button>
          <button onClick={initSimulation} className="p-2 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"><RefreshCw size={18} /></button>
        </div>
      </header>

      {/* 第一排：三個正方形圖表區 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-3 rounded-xl shadow-md border border-slate-200 flex flex-col items-center">
          <h3 className="text-[11px] font-bold mb-2 self-start text-slate-500 uppercase tracking-tighter">池塘動態觀察窗</h3>
          <div className="w-full aspect-square relative bg-sky-50 rounded-lg overflow-hidden border border-slate-100">
             <canvas ref={canvasRef} width={canvasSize} height={canvasSize} className="w-full h-full" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-md border border-slate-200 flex flex-col">
          <h3 className="text-[11px] font-bold mb-2 text-slate-500 flex items-center gap-1"><AlertTriangle size={14} className="text-amber-500"/> 各階層平均 DDT 濃度 (ppm)</h3>
          <div className="flex-1 aspect-square w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{fontSize: 9}} label={{ value: '年份', position: 'insideBottomRight', offset: -10, fontSize: 9 }} />
                <YAxis tick={{fontSize: 9}} tickFormatter={(v) => v > 1000 ? ${(v/1000).toFixed(1)}k : v} />
                <Tooltip labelStyle={{fontSize: '10px'}} contentStyle={{fontSize: '10px'}} />
                <Line name="鵜鶘" type="monotone" dataKey="鵜鶘濃度" stroke={SPECIES.PELICAN.color} dot={false} strokeWidth={2.5} isAnimationActive={false} />
                <Line name="鮭魚" type="monotone" dataKey="鮭魚濃度" stroke={SPECIES.SALMON.color} dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line name="胡瓜魚" type="monotone" dataKey="胡瓜魚濃度" stroke={SPECIES.SMELT.color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line name="浮游動物" type="monotone" dataKey="動物濃度" stroke={SPECIES.ZPLANKTON.color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line name="浮游藻類" type="monotone" dataKey="藻類濃度" stroke={SPECIES.PPLANKTON.color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '9px', paddingTop: '10px'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-md border border-slate-200 flex flex-col">
          <h3 className="text-[11px] font-bold mb-2 text-slate-500 flex items-center gap-1"><BarChart3 size={14} className="text-emerald-500"/> 生物總量</h3>
          <div className="flex-1 aspect-square w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{fontSize: 9}} label={{ value: '年份', position: 'insideBottomRight', offset: -10, fontSize: 9 }} />
                <YAxis tick={{fontSize: 9}} />
                <Tooltip labelStyle={{fontSize: '10px'}} contentStyle={{fontSize: '10px'}} />
                <Area name="浮游藻類" type="monotone" dataKey="浮游藻類量" stroke={SPECIES.PPLANKTON.color} fill={SPECIES.PPLANKTON.color} fillOpacity={0.1} dot={false} isAnimationActive={false} />
                <Area name="浮游動物" type="monotone" dataKey="浮游動物量" stroke={SPECIES.ZPLANKTON.color} fill={SPECIES.ZPLANKTON.color} fillOpacity={0.15} dot={false} isAnimationActive={false} />
                <Area name="胡瓜魚" type="monotone" dataKey="胡瓜魚量" stroke={SPECIES.SMELT.color} fill={SPECIES.SMELT.color} fillOpacity={0.2} dot={false} isAnimationActive={false} />
                <Area name="鮭魚" type="monotone" dataKey="鮭魚量" stroke={SPECIES.SALMON.color} fill={SPECIES.SALMON.color} fillOpacity={0.25} dot={false} isAnimationActive={false} />
                <Area name="鵜鶘" type="monotone" dataKey="鵜鶘量" stroke={SPECIES.PELICAN.color} fill={SPECIES.PELICAN.color} fillOpacity={0.3} dot={false} isAnimationActive={false} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '9px', paddingTop: '10px'}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* 控制面板 */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
             <div className="flex justify-between items-center mb-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>時間軸控制</span> <span className="bg-blue-600 text-white px-3 py-0.5 rounded-full font-bold">目標：{targetYear}y</span>
              </div>
              <div className="relative h-6 flex items-center mb-4">
                <div className="absolute w-full h-1.5 bg-slate-200 rounded-full" />
                <div className="absolute h-1.5 bg-emerald-500 rounded-full transition-all" style={{ width: ${(currentYear / 100) * 100}% }} />
                <input 
                  type="range" min="0" max="100" step="10" value={targetYear} onChange={(e) => setTargetYear(parseInt(e.target.value))}
                  disabled={isRunning} className="absolute w-full h-6 bg-transparent appearance-none cursor-pointer z-30 accent-blue-700"
                />
              </div>
              <div className="flex justify-between px-1 text-slate-400 font-mono text-[10px]">
                {[0, 20, 40, 60, 80, 100].map(v => <span key={v}>{v}y</span>)}
              </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1 uppercase"><Waves size={14} className="text-blue-500" /> DDT 排放量</span>
              <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono font-bold">{ddtContamination.toFixed(2)} ppm</span>
            </div>
            <input type="range" min="0" max="5" step="0.1" value={ddtContamination} onChange={(e) => setDdtContamination(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest text-center">當前平均濃度讀數 (ppm)</h4>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {Object.entries(SPECIES).map(([key, s]) => {
                const group = entities.filter(e => e.type === s.type);
                const avgDDT = group.length > 0 ? (group.reduce((a, c) => a + c.ddt, 0) / group.length).toFixed(1) : "0.0";
                return (
                  <div key={key} className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: s.color}} />
                      <span className="font-bold text-slate-600">{s.label}</span>
                    </div>
                    <div className="font-mono font-bold text-slate-700 text-right">{avgDDT}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 探究提問區 */}
        <div className="xl:col-span-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-emerald-500 h-full">
            <h4 className="font-bold flex items-center gap-2 mb-4 text-emerald-800 text-base"><Target size={20}/> 探究實驗室</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <p className="font-bold text-emerald-700 mb-2 underline underline-offset-4">Q1：時間的禮物？</p>
                <p className="leading-relaxed text-xs">觀察前 10 年與後 50 年。為什麼即使污染強度（DDT 滑桿）沒變，高階掠食者的 DDT 濃度卻會隨時間不斷飆升？</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <p className="font-bold text-emerald-700 mb-2 underline underline-offset-4">Q2：壽命的影響</p>
                <p className="leading-relaxed text-xs">當生物體型越大、壽命越長時，牠累積毒素的潛力會如何變化？（提示：觀察鮭魚與鵜鶘的曲線斜率差異）</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 md:col-span-2">
                <p className="font-bold text-emerald-700 mb-2 underline underline-offset-4">Q3：營養階層的濃縮漏斗</p>
                <p className="font-medium leading-relaxed text-xs">觀察上方的「生物總量」。隨着食物鏈向上，生物總量呈現劇烈下降。請思考：如果 DDT 的「總量」在傳遞中沒有減少，但承載毒素的「生物箱子（總質量）」變得越來越小，這對頂端生物的濃度會造成什麼爆炸性結果？</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 md:col-span-2">
                <p className="font-bold text-emerald-700 mb-2 underline underline-offset-4">Q4：清除的困難</p>
                <p className="leading-relaxed text-xs font-medium">【實驗任務】請在中途將「DDT 排放量」設為 0 並繼續運行。觀察哪種生物體內的毒素濃度下降最慢？為什麼即使沒有新污染，高階生物的濃度依然居高不下？</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
<div className="text-[10px] text-slate-400 text-center italic mt-8 border-t border-slate-200 pt-4">
        Simulation Logic based on Virtual Biology Lab | Copyright © Virtual Biology Lab
      </div>
    </div>
  );
};

export default App;
