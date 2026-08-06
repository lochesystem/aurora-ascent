"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuroraGame, type GameSnapshot } from "./engine";
import { CAMPAIGN_LEVELS, generateLevel } from "./levels.js";
import { findNextSpatialIndex, gamepadMenuDirection } from "./menuNavigation.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GameSettings } from "./settings";

type Screen = "title" | "map" | "playing" | "paused" | "dead" | "victory";
const EMPTY: GameSnapshot = { coins: 0, totalCoins: 7, health: 3, enemies: 2, totalEnemies: 2, gamepad: "" };

export default function GameShell() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AuroraGame | null>(null);
  const menuButtonsRef = useRef(new Set<number>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"video" | "controls" | "controller">("video");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY);
  const [toast, setToast] = useState("");
  const [damageFlash, setDamageFlash] = useState(false);
  const [activeLevel, setActiveLevel] = useState(1);
  const [unlockedLevel, setUnlockedLevel] = useState(1);
  const [runId, setRunId] = useState(0);
  const levelInfo=generateLevel(activeLevel);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1700);
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
    const saved=Number(localStorage.getItem("aurora-ascent-progress")||1);setUnlockedLevel(Math.max(1,Math.min(26,saved)));
    if (!canvasRef.current) return;
    const game = new AuroraGame(canvasRef.current, {
      onSnapshot: setSnapshot,
      onDeath: () => setScreen("dead"),
      onVictory: () => {
        const next=Math.min(26,activeLevel+1);setUnlockedLevel(current=>{const unlocked=Math.max(current,next);localStorage.setItem("aurora-ascent-progress",String(unlocked));return unlocked});setScreen("victory");
      },
      onToast: showToast,
      onDamage: () => {
        setDamageFlash(false);
        requestAnimationFrame(() => setDamageFlash(true));
      },
      onPause: () => setScreen((current) => current === "playing" ? "paused" : current),
    }, activeLevel);
    gameRef.current = game;
    void game.init(loadSettings());
    return () => { game.destroy(); gameRef.current = null; };
  }, [showToast,activeLevel,runId]);

  useEffect(() => {
    gameRef.current?.setPaused(screen !== "playing");
  }, [screen]);

  const updateSettings = (patch: Partial<GameSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      gameRef.current?.applySettings(next);
      return next;
    });
  };

  const startLevel = (level=activeLevel) => {
    setActiveLevel(level);
    setRunId(current=>current+1);
    setScreen("playing");
    setSettingsOpen(false);
    showToast(`Fase ${level} · ${generateLevel(level).name}`);
    canvasRef.current?.focus();
  };

  const resume = () => {
    setSettingsOpen(false);
    setScreen("playing");
    canvasRef.current?.focus();
  };

  const openSettings = (from: Screen = screen) => {
    if (from === "playing") setScreen("paused");
    setSettingsOpen(true);
  };

  useEffect(() => {
    if(screen==="playing")return;
    let frame=0,lastDirection:string|null=null,nextRepeat=0;const heldButtons=menuButtonsRef.current;
    const menuScope=()=>{const root=rootRef.current;if(!root)return null;if(settingsOpen)return root.querySelector<HTMLElement>('[data-menu-screen="settings"]');return root.querySelector<HTMLElement>(`[data-menu-screen="${screen}"]`)};
    const focusables=()=>Array.from(menuScope()?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled)')??[]).filter(element=>element.getClientRects().length>0);
    const focusElement=(element:HTMLElement)=>{document.querySelectorAll('.gamepad-focus').forEach(item=>item.classList.remove('gamepad-focus'));element.focus({preventScroll:false});element.classList.add('gamepad-focus');element.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"})};
    const focusDefault=()=>{const items=focusables();if(!items.length)return null;const preferred=items.find(item=>item.hasAttribute('data-gamepad-default'))??items[0];focusElement(preferred);return preferred};
    const goBack=()=>{if(settingsOpen){setSettingsOpen(false);return}if(screen==="map"){setScreen("title");return}if(screen==="paused"){resume();return}if(screen==="dead"||screen==="victory")setScreen("map")};
    const changeControl=(element:HTMLElement,direction:string)=>{if(direction!=="left"&&direction!=="right")return false;const delta=direction==="right"?1:-1;if(element instanceof HTMLInputElement&&element.type==="range"){const step=Number(element.step)||1,min=Number(element.min),max=Number(element.max),next=Math.max(min,Math.min(max,Number(element.value)+step*delta));element.value=String(next);element.dispatchEvent(new Event("input",{bubbles:true}));element.dispatchEvent(new Event("change",{bubbles:true}));return true}if(element instanceof HTMLSelectElement){element.selectedIndex=Math.max(0,Math.min(element.options.length-1,element.selectedIndex+delta));element.dispatchEvent(new Event("change",{bubbles:true}));return true}return false};
    const tick=(time:number)=>{const pad=Array.from(navigator.getGamepads?.()??[]).find(Boolean);if(pad){const pressed=pad.buttons.map(button=>button.pressed||button.value>.55);const items=focusables();const current=items.indexOf(document.activeElement as HTMLElement);const confirm=pressed[0]&&!heldButtons.has(0),back=pressed[1]&&!heldButtons.has(1),options=pressed[9]&&!heldButtons.has(9);if(confirm){if(current<0){focusDefault()?.click()}else items[current].click()}if(back)goBack();if(options&&screen==="paused")resume();const direction=gamepadMenuDirection(pad.axes,pressed);if(direction){if(direction!==lastDirection||time>=nextRepeat){if(current<0)focusDefault();else if(!changeControl(items[current],direction)){const next=findNextSpatialIndex(items.map(item=>item.getBoundingClientRect()),current,direction);if(next>=0)focusElement(items[next])}nextRepeat=time+(direction===lastDirection?115:310)}lastDirection=direction}else lastDirection=null;heldButtons.clear();pressed.forEach((value,index)=>{if(value)heldButtons.add(index)})}else heldButtons.clear();frame=requestAnimationFrame(tick)};
    const clearMouseFocus=()=>document.querySelectorAll('.gamepad-focus').forEach(item=>item.classList.remove('gamepad-focus'));
    const initial=window.setTimeout(()=>{if(Array.from(navigator.getGamepads?.()??[]).some(Boolean))focusDefault()},80);window.addEventListener("pointerdown",clearMouseFocus,{passive:true});frame=requestAnimationFrame(tick);
    return()=>{window.clearTimeout(initial);cancelAnimationFrame(frame);window.removeEventListener("pointerdown",clearMouseFocus);document.querySelectorAll('.gamepad-focus').forEach(item=>item.classList.remove('gamepad-focus'))};
  },[screen,settingsOpen,settingsTab]);

  return (
    <main ref={rootRef} className="game-root">
      <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Aurora Ascent, jogo de plataforma 3D" />

      <div className={`hud ${screen !== "playing" ? "hidden" : ""}`} aria-live="polite">
        <div className="hud-top">
          <div className="hud-cluster">
            <div className="level-pill"><span>Fase</span><b>{activeLevel}</b></div>
            <div className="hud-card"><div className="coin-glyph"/><div><span className="hud-label">Fragmentos</span><strong className="hud-value">{String(snapshot.coins).padStart(2,"0")} / {snapshot.totalCoins}</strong></div></div>
            <div className="hud-card"><div className="hearts">{[0,1,2].map(i => <span key={i} className={`heart ${i >= snapshot.health ? "empty" : ""}`}>♥</span>)}</div></div>
          </div>
          <div className="objective hud-card"><div style={{width:"100%"}}><span className="hud-label">Objetivo atual</span><strong>{snapshot.coins < snapshot.totalCoins ? "Colete todos os fragmentos" : snapshot.enemies > 0 ? "Derrote os guardiões" : "Suba ao farol"}</strong><div className="progress"><i style={{width:`${(snapshot.coins / snapshot.totalCoins) * 100}%`}}/></div></div></div>
          <div className="hud-card"><div><span className="hud-label">Guardiões</span><strong className="hud-value">{snapshot.totalEnemies - snapshot.enemies} / {snapshot.totalEnemies}</strong></div></div>
        </div>
        <div className={`gamepad-pill ${snapshot.gamepad ? "connected" : ""}`}><i/>{snapshot.gamepad || "Controle não conectado"}</div>
        <div className="hud-bottom"><span className="prompt"><b className="key">Espaço ×2</b> Pulo duplo</span><span className="prompt"><b className="key">⚠</b> Pousos fortes derrapam</span><span className="prompt"><b className="key">F</b> Golpear</span><span className="prompt"><b className="key">Esc</b> Pausar</span></div>
      </div>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
      <div className={`damage-flash ${damageFlash ? "show" : ""}`} onAnimationEnd={() => setDamageFlash(false)}/>

      <section data-menu-screen="title" className={`screen title-screen ${screen !== "title" ? "hidden" : ""}`}>
        <div className="title-card">
          <p className="eyebrow">Uma aventura acima das nuvens</p>
          <h1>Aurora <span>Ascent</span></h1>
          <p className="tagline">Os fragmentos solares se espalharam pelas ilhas do céu. Corra, salte e lute até o farol antes que a última luz desapareça.</p>
          <div className="menu-actions"><button data-gamepad-default className="primary-btn" onClick={() => setScreen("map")}>Mapa de fases</button><button className="secondary-btn" onClick={() => openSettings("title")}>Configurações</button></div>
          <div className="controls-strip"><span><b className="key">WASD</b> mover</span><span><b className="key">Mouse</b> câmera</span><span><b className="key">F</b> ataque</span><span><b className="key">✕</b> DualSense</span></div>
        </div>
      </section>

      {screen === "map" && <section data-menu-screen="map" className="campaign-screen">
        <div className="campaign-heading"><div><p className="eyebrow">Caminho da Aurora</p><h2>Mapa de fases</h2><p>Complete cada ilha para abrir a próxima rota. O desafio aumenta a cada cinco fases.</p></div><div className="campaign-actions"><span>{Math.min(25,unlockedLevel-1)} / 25 concluídas</span><button className="secondary-btn" onClick={()=>setScreen("title")}>Voltar</button></div></div>
        <div className="campaign-scroll">
          <div className="level-path" aria-label="Seleção de fases">
            {CAMPAIGN_LEVELS.map((level)=>{const unlocked=level.number<=unlockedLevel;const completed=level.number<unlockedLevel;return <div key={level.number}>{level.connector&&<span className={`route-segment ${completed?"completed":""}`} style={{left:level.connector.x,top:level.connector.y,width:level.connector.length,transform:`rotate(${level.connector.angle}deg)`}}/>}<button data-gamepad-default={level.number===unlockedLevel||undefined} disabled={!unlocked} onClick={()=>startLevel(level.number)} className={`level-node region-${level.region} ${completed?"completed":""} ${level.number===unlockedLevel?"current":""} ${level.number%5===0?"boss":""} ${level.map.x>400?"label-left":""}`} style={{left:level.map.x,top:level.map.y}} aria-label={`Fase ${level.number}: ${level.name}${unlocked?"":" bloqueada"}`}><span className="node-crown">{completed?"★":unlocked?level.number:"◆"}</span><span className="node-copy"><strong>{level.name}</strong><small>{level.gimmick}</small></span></button></div>})}
          </div>
        </div>
      </section>}

      {screen === "paused" && !settingsOpen && <div data-menu-screen="paused" className="modal-backdrop"><div className="pause-card"><p className="eyebrow" style={{justifyContent:"center"}}>Jornada suspensa</p><h2>Pausado</h2><p>Respire. As ilhas continuarão aqui.</p><div className="menu-actions"><button data-gamepad-default className="primary-btn" onClick={resume}>Continuar</button><button className="secondary-btn" onClick={() => openSettings("paused")}>Configurações</button><button className="secondary-btn" onClick={() => setScreen("title")}>Menu inicial</button></div></div></div>}

      {screen === "dead" && <div data-menu-screen="dead" className="modal-backdrop death-screen"><div className="result-card"><p className="eyebrow" style={{justifyContent:"center"}}>A névoa levou sua luz</p><h2>Você caiu</h2><p>A fase {activeLevel} recomeça do início: fragmentos, guardiões e plataformas foram restaurados.</p><div className="menu-actions"><button data-gamepad-default className="primary-btn" onClick={()=>startLevel()}>Tentar novamente</button><button className="secondary-btn" onClick={() => setScreen("map")}>Mapa de fases</button></div></div></div>}

      {screen === "victory" && <div data-menu-screen="victory" className="modal-backdrop victory-screen"><div className="result-card"><p className="eyebrow" style={{justifyContent:"center"}}>Fase {activeLevel} concluída</p><h2>{activeLevel===25?"Cume conquistado!":"Rota aberta!"}</h2><p>Você reuniu os {snapshot.totalCoins} fragmentos e derrotou todos os guardiões de {levelInfo.name}.</p><div className="menu-actions">{activeLevel<25&&<button data-gamepad-default className="primary-btn" onClick={()=>startLevel(activeLevel+1)}>Próxima fase</button>}<button data-gamepad-default={activeLevel===25||undefined} className="secondary-btn" onClick={() => setScreen("map")}>Mapa de fases</button></div></div></div>}

      <div data-menu-screen="settings" className={`modal-backdrop ${settingsOpen ? "" : "hidden"}`}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="Configurações">
          <div className="modal-header"><div><p className="eyebrow">Personalize sua jornada</p><h2>Configurações</h2></div><button className="icon-btn" aria-label="Fechar" onClick={() => { setSettingsOpen(false); if (screen === "title") return; }}>×</button></div>
          <div className="settings-tabs">{([['video','Vídeo'],['controls','Controles'],['controller','DualSense']] as const).map(([id,label]) => <button data-gamepad-default={settingsTab===id||undefined} key={id} className={`tab ${settingsTab === id ? "active" : ""}`} onClick={() => setSettingsTab(id)}>{label}</button>)}</div>
          <div className={`settings-panel ${settingsTab === "video" ? "active" : ""}`}>
            <div className="setting-row"><div><label>Qualidade visual</label><small>Altera resolução, sombras e densidade de partículas.</small></div><select value={settings.quality} onChange={e => updateSettings({quality:e.target.value as GameSettings['quality']})}><option value="low">Desempenho</option><option value="medium">Equilibrado</option><option value="high">Cinemático</option></select></div>
            <div className="setting-row"><div><span className="setting-title">Sombras dinâmicas</span><small>Profundidade extra para personagens e plataformas.</small></div><label className="toggle"><input type="checkbox" checked={settings.shadows} onChange={e => updateSettings({shadows:e.target.checked})}/><i/></label></div>
            <div className="setting-row"><div><span className="setting-title">Brilho mágico</span><small>Realça fragmentos, farol e energia dos golpes.</small></div><label className="toggle"><input type="checkbox" checked={settings.bloom} onChange={e => updateSettings({bloom:e.target.checked})}/><i/></label></div>
          </div>
          <div className={`settings-panel ${settingsTab === "controls" ? "active" : ""}`}>
            <div className="setting-row"><div><label>Sensibilidade da câmera</label><small>{Math.round(settings.cameraSensitivity*100)}%</small></div><input aria-label="Sensibilidade da câmera" type="range" min="30" max="150" value={settings.cameraSensitivity*100} onChange={e => updateSettings({cameraSensitivity:Number(e.target.value)/100})}/></div>
            <div className="setting-row"><div><span className="setting-title">Inverter eixo vertical</span><small>Inverte o movimento vertical da câmera.</small></div><label className="toggle"><input type="checkbox" checked={settings.invertY} onChange={e => updateSettings({invertY:e.target.checked})}/><i/></label></div>
            <div className="mapping-grid"><div className="mapping"><b className="key">WASD</b> Movimento</div><div className="mapping"><b className="key">Espaço ×2</b> Pulo duplo</div><div className="mapping"><b className="key">F / Click</b> Golpear</div><div className="mapping"><b className="key">Mouse</b> Girar câmera</div><div className="mapping"><b className="key">Esc</b> Pausar</div><div className="mapping"><b className="key">R</b> Recentrar câmera</div></div>
          </div>
          <div className={`settings-panel ${settingsTab === "controller" ? "active" : ""}`}>
            <div className={`controller-status ${snapshot.gamepad ? "connected" : ""}`}>{snapshot.gamepad || "Pressione um botão no controle para conectar"}</div>
            <div className="setting-row"><div><span className="setting-title">Controle habilitado</span><small>Compatível com DualSense e controles padrão.</small></div><label className="toggle"><input type="checkbox" checked={settings.gamepadEnabled} onChange={e => updateSettings({gamepadEnabled:e.target.checked})}/><i/></label></div>
            <div className="setting-row"><div><label>Zona morta dos analógicos</label><small>{Math.round(settings.deadzone*100)}%</small></div><input aria-label="Zona morta" type="range" min="5" max="50" value={settings.deadzone*100} onChange={e => updateSettings({deadzone:Number(e.target.value)/100})}/></div>
            <div className="setting-row"><div><label>Intensidade da vibração</label><small>{Math.round(settings.vibration*100)}%</small></div><input aria-label="Vibração" type="range" min="0" max="100" value={settings.vibration*100} onChange={e => updateSettings({vibration:Number(e.target.value)/100})}/></div>
            <div className="mapping-grid"><div className="mapping"><b className="key">✕ ×2</b> Pulo duplo</div><div className="mapping"><b className="pad-key">□</b> Golpear</div><div className="mapping"><b className="pad-key">L</b> Movimento</div><div className="mapping"><b className="pad-key">R</b> Câmera</div><div className="mapping"><b className="pad-key">R2</b> Golpear</div><div className="mapping"><b className="pad-key">☰</b> Pausar</div></div>
            <div className="menu-actions" style={{marginTop:18}}><button className="secondary-btn" onClick={() => gameRef.current?.testVibration()}>Testar vibração</button></div>
          </div>
          <div className="settings-footer"><button className="secondary-btn" onClick={() => updateSettings(DEFAULT_SETTINGS)}>Restaurar padrão</button><button className="primary-btn" onClick={() => { setSettingsOpen(false); if (screen === "paused") resume(); }}>Concluir</button></div>
        </div>
      </div>
    </main>
  );
}
