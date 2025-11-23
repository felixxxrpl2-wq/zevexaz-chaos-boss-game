const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreTag = document.getElementById('scoreTag');
const levelTag = document.getElementById('levelTag');
const livesTag = document.getElementById('livesTag');
const timeTag = document.getElementById('timeTag');

const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnShoot = document.getElementById('btnShoot');

let WIDTH = canvas.width;
let HEIGHT = canvas.height;
function resizeCanvasToDisplay(){
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  ctx.setTransform(scaleX,0,0,scaleY,0,0);
}
window.addEventListener('resize', ()=>{ resizeCanvasToDisplay(); });

let running = false;
let lastTime = 0;
const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key]=true; if(e.key===' ') e.preventDefault(); });
window.addEventListener('keyup', e=>{ keys[e.key]=false; });

let touchLeft=false, touchRight=false, touchShoot=false;
btnLeft&&btnLeft.addEventListener('pointerdown',e=>{e.preventDefault();touchLeft=true}); btnLeft&&btnLeft.addEventListener('pointerup',e=>{e.preventDefault();touchLeft=false}); btnLeft&&btnLeft.addEventListener('pointercancel',()=>{touchLeft=false});
btnRight&&btnRight.addEventListener('pointerdown',e=>{e.preventDefault();touchRight=true}); btnRight&&btnRight.addEventListener('pointerup',e=>{e.preventDefault();touchRight=false}); btnRight&&btnRight.addEventListener('pointercancel',()=>{touchRight=false});
btnShoot&&btnShoot.addEventListener('pointerdown',e=>{e.preventDefault();touchShoot=true}); btnShoot&&btnShoot.addEventListener('pointerup',e=>{e.preventDefault();touchShoot=false}); btnShoot&&btnShoot.addEventListener('pointercancel',()=>{touchShoot=false});

let player = { x: WIDTH/2, y: HEIGHT-80, radius:20, baseColor:'cyan', color:'cyan', animPulse:0, animSpeed:0.09, lastX:null, trail:[], shootCooldown:0, vx:0 };
let particles = [], bullets = [], enemies = [], bossBullets = [], afterimages = [], curseZones = [];
let spawnTimer=0, spawnInterval=0.9, enemySpeedMultiplier=1;
let score=0, lives=3, timeLeft=60, gameDuration=60, level=1, nextLevelScore=40;
let boss=null, bossNextScore=80, bossLaser=null, gravityActive=false, gravityTimer=0, gravitySource=null;
const enemyTypes=[
  {name:'normal', color:'#f43f5e', radius:14, speed:90},
  {name:'zigzag', color:'#fb923c', radius:16, speed:100, zigzag:true},
  {name:'tank', color:'#a78bfa', radius:24, speed:60, hp:2},
  {name:'fast', color:'#facc15', radius:11, speed:160}
];

function startGame(){ running=true; lastTime=performance.now(); requestAnimationFrame(gameLoop); startBtn.disabled=true; restartBtn.disabled=false; }
function resetGame(){
  enemies=[]; particles=[]; bullets=[]; bossBullets=[]; afterimages=[]; curseZones=[]; boss=null; bossLaser=null; gravityActive=false;
  player.trail=[]; player.x=WIDTH/2; player.lastX=null; player.shootCooldown=0; player.color=player.baseColor; player.vx=0;
  score=0; lives=3; timeLeft=gameDuration; level=1; nextLevelScore=40; spawnInterval=0.9; enemySpeedMultiplier=1; bossNextScore=80;
  updateHUD(); startBtn.disabled=false; restartBtn.disabled=true;
}
restartBtn.addEventListener('click', ()=>{ resetGame(); startGame(); });
startBtn.addEventListener('click', ()=>{ startGame(); });

function gameLoop(ts){
  if(!running) return;
  const dt=Math.min((ts-lastTime)/1000,0.05); lastTime=ts;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

function update(dt){
  handleInput(dt); updatePlayer(dt); updateTrail(); updateParticles(); updateBullets(dt); updateEnemies(dt); updateBoss(dt); updateBossBullets(dt); updateAfterimages(dt); updateCurseZones(dt); updateGravity(dt); updateTimer(dt); updateLevel(); updateHUD();
}

function handleInput(dt){
  player.vx=0;
  const left = keys['ArrowLeft']||keys['a']||touchLeft;
  const right = keys['ArrowRight']||keys['d']||touchRight;
  const shootKey = keys[' ']||keys['Spacebar']||touchShoot||keys['k']||keys['K'];
  if(left && !right) player.vx=-360;
  if(right && !left) player.vx=360;
  if(shootKey && player.shootCooldown<=0){ shoot(); player.shootCooldown=0.16; }
  if(player.shootCooldown>0) player.shootCooldown-=dt;
}

function updatePlayer(dt){
  if(player.vx) player.x += player.vx*dt;
  player.x = Math.max(player.radius, Math.min(WIDTH-player.radius, player.x));
  player.animPulse += player.animSpeed;
}

function updateTrail(){
  if(player.lastX!==null){
    const dx = player.x - player.lastX;
    if(Math.abs(dx)>2) player.trail.push({x:player.x,y:player.y,r:player.radius,alpha:0.45});
  }
  player.lastX=player.x;
  for(let t of player.trail) t.alpha-=0.025;
  player.trail = player.trail.filter(t=>t.alpha>0);
}

function updateParticles(){
  particles.push({x:player.x+(Math.random()*12-6), y:player.y+player.radius+6, size:Math.random()*3+1.5, alpha:1, vy:Math.random()*0.6+0.4, col:player.color});
  for(let p of particles){ p.y += p.vy; p.alpha -= 0.025; }
  particles = particles.filter(p=>p.alpha>0);
}

function shoot(){ bullets.push({x:player.x, y:player.y-player.radius-8, vy:-520, r:4, life:1.6}); afterimages.push({x:player.x,y:player.y,r:player.radius,alpha:0.6,life:0.18}); }

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i]; b.y += b.vy*dt; b.life -= dt; if(b.y < -10 || b.life<=0) bullets.splice(i,1);
  }
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j]; const dx=b.x-e.x; const dy=b.y-e.y;
      if(dx*dx+dy*dy <= (b.r+e.radius)*(b.r+e.radius)){ enemies.splice(j,1); bullets.splice(i,1); score+=15; spawnHitParticles(e.x,e.y,6); break; }
    }
  }
  if(boss){
    for(let i=bullets.length-1;i>=0;i--){
      const b=bullets[i]; const dx=b.x-boss.x; const dy=b.y-boss.y;
      if(dx*dx+dy*dy <= (b.r+boss.radius)*(b.r+boss.radius)){ bullets.splice(i,1); boss.hp-=1; spawnHitParticles(boss.x,boss.y,10); if(boss.hp<=0) bossDies(); break; }
    }
  }
}

function spawnHitParticles(x,y,n){ for(let i=0;i<n;i++) particles.push({x:x+(Math.random()*30-15), y:y+(Math.random()*30-15), size:Math.random()*3+1, alpha:1, vy:Math.random()*1+0.2, col:'#ffb3ff'}); }

function spawnEnemy(){
  const t = enemyTypes[Math.floor(Math.random()*enemyTypes.length)];
  const r = t.radius;
  enemies.push({ x:Math.random()*(WIDTH-r*2)+r, y:-r-10, radius:r, color:t.color, baseSpeed:t.speed, speed:(t.speed)*(0.9+enemySpeedMultiplier*0.15)/60, zigzag:t.zigzag||false, hp:t.hp||1, zigDir:Math.random()<0.5?-1:1, ang:Math.random()*10, fake:false });
}

function updateEnemies(dt){
  spawnTimer += dt;
  if(!boss && spawnTimer >= spawnInterval){ spawnTimer=0; spawnEnemy(); }
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.zigzag){ e.ang += dt*6; e.x += Math.sin(e.ang)*30*dt*e.zigDir; }
    e.y += e.speed*dt*60;
    if(e.y - e.radius > HEIGHT+40){ enemies.splice(i,1); score+=10; }
    else{
      const dx = player.x - e.x; const dy = player.y - e.y;
      if(dx*dx+dy*dy <= (player.radius+e.radius)*(player.radius+e.radius)){
        enemies.splice(i,1); lives-=1; spawnHitParticles(e.x,e.y,8); if(lives<=0) endGame();
      }
    }
  }
}

function spawnBoss(){
  boss = { x:WIDTH/2, y:-180, radius:90, color:'rgba(8,0,24,0.98)', hp:40+level*18, maxHp:40+level*18, speed:90+level*20, dir:1, skillTimer:0, skillInterval:120, auraPhase:0, shake:0 };
  player.color='magenta';
}

function updateBoss(dt){
  if(!boss){ if(score >= bossNextScore){ spawnBoss(); bossNextScore += 100 + level*40; } return; }
  boss.auraPhase += dt*2;
  if(boss.y < 140){ boss.y += boss.speed*dt*0.25; return; }
  if(boss.mode === 'dash' && boss.dashTarget !== undefined){ const spd = boss.dashSpeed|| (18+level); if(Math.abs(boss.x-boss.dashTarget)>6) boss.x += Math.sign(boss.dashTarget-boss.x)*spd*dt*60; else boss.mode='idle'; }
  else { boss.x += boss.dir * boss.speed * dt * 0.45; if(boss.x < boss.radius+10 || boss.x > WIDTH - boss.radius -10) boss.dir *= -1; }
  boss.skillTimer += dt*60;
  if(boss.skillTimer >= boss.skillInterval){ boss.skillTimer=0; boss.skillInterval = Math.max(40, boss.skillInterval*0.82); chooseBossSkill(); }
  if(boss.shake>0) boss.shake = Math.max(0,boss.shake - dt*8);
  if(boss.hp <= 0) bossDies();
}

function chooseBossSkill(){
  const r = Math.random();
  if(r < 0.18) bossBulletHell();
  else if(r < 0.34) bossMegaLaser();
  else if(r < 0.52) bossBlackHole();
  else if(r < 0.68) bossMeteorStorm();
  else if(r < 0.82) bossTeleportDash();
  else if(r < 0.92) bossCurseZones();
  else bossChaosOrbRing();
}

function bossBulletHell(){
  const centerX = boss.x;
  const waves = 5 + Math.floor(level/2);
  for(let w=0; w<waves; w++){
    const count = 28 + Math.floor(Math.random()*18);
    const spread = Math.PI*1.6;
    for(let i=0;i<count;i++){
      const angle = -Math.PI/2 + (i/count - 0.5)*spread + (Math.random()*0.12-0.06) + (w*0.08);
      const speed = 140 + Math.random()*180 + level*8;
      bossBullets.push({ x:centerX, y:boss.y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, size:6, ttl:6, type:'bullethell' });
    }
  }
  boss.shake = 0.9;
}

function bossMegaLaser(){
  bossLaser = { x: boss.x - 20, y: boss.y + boss.radius+10, width:40, height:HEIGHT*1.5, charging: true, timer: 90, sweep:false };
  boss.shake = 1.5;
}

function bossBlackHole(){
  const hole = { x: boss.x, y: boss.y, radius:160 + level*20, timer: 140, pull: 0.9 + level*0.06 };
  bossBullets.push({ type:'blackhole', hole:hole, x:hole.x, y:hole.y });
  boss.shake = 1.2;
}

function bossMeteorStorm(){
  const n = 8 + Math.floor(level/2);
  for(let i=0;i<n;i++) bossBullets.push({ x: Math.random()*WIDTH, y: -40 - Math.random()*300, vy: 240 + Math.random()*160 + level*10, size:28 + Math.random()*36, type:'meteor' });
  boss.shake = 1.2;
}

function bossTeleportDash(){
  boss.mode='dash'; boss.dashTarget = Math.random()*(WIDTH-200)+100; boss.dashSpeed = 28 + level*1.2;
  for(let i=0;i<6;i++) afterimages.push({x:boss.x + (Math.random()*60-30), y:boss.y + (Math.random()*60-30), r:boss.radius, alpha:0.6, life:0.28});
  boss.shake = 0.9;
}

function bossCurseZones(){
  const zones = 3 + Math.floor(level/3);
  for(let i=0;i<zones;i++){
    const x = Math.random()*(WIDTH-160)+80;
    curseZones.push({ x:x, y:HEIGHT+30, w:120, h:40, riseSpeed:-260, timer:140, color:'rgba(80,0,120,0.24)' });
  }
  boss.shake = 0.6;
}

function bossChaosOrbRing(){
  const count = 20 + level*6;
  for(let i=0;i<count;i++){
    const ang = (i/count)*Math.PI*2 + Math.random()*0.4;
    const rad = 60 + Math.random()*40;
    bossBullets.push({ x: boss.x + Math.cos(ang)*rad, y: boss.y + Math.sin(ang)*rad, vx: Math.cos(ang)*(120+level*8), vy: Math.sin(ang)*(120+level*8), size:10, type:'orb' });
  }
  boss.shake = 1.0;
}

function updateBossBullets(dt){
  for(let i=bossBullets.length-1;i>=0;i--){
    const m = bossBullets[i];
    if(m.type === 'bullethell' || m.type === 'orb'){ m.x += (m.vx||0)*dt; m.y += (m.vy||0)*dt; }
    else if(m.type==='meteor'){ m.y += (m.vy||200)*dt; }
    else if(m.type==='blackhole'){ m.hole.timer -= dt*60; if(m.hole.timer<=0) bossBullets.splice(i,1); }
    else { m.y += (m.vy||120)*dt; }
    if(m.x < -200 || m.x > WIDTH+200 || m.y > HEIGHT+300 || m.y < -400) bossBullets.splice(i,1);
    else{
      if(m.type==='blackhole'){ applyBlackHole(m.hole, dt); continue; }
      const dx = player.x - m.x; const dy = player.y - m.y;
      const r = (m.size||8) + player.radius;
      if(dx*dx+dy*dy <= r*r){
        if(m.type==='meteor' || m.type==='bullethell' || m.type==='orb'){ bossBullets.splice(i,1); lives--; spawnHitParticles(m.x,m.y,8); if(lives<=0) endGame(); }
      }
    }
  }
  if(bossLaser){
    if(bossLaser.charging){ bossLaser.timer--; if(bossLaser.timer<=0){ bossLaser.charging=false; bossLaser.chargingPhase=18; } }
    else if(bossLaser.chargingPhase && bossLaser.chargingPhase>0){ bossLaser.chargingPhase--; if(bossLaser.chargingPhase===0){ bossLaser.sweep=true; bossLaser.x=-80; } }
    else if(bossLaser.sweep){ bossLaser.x += (8 + level*0.6); if(player.x > bossLaser.x && player.x < bossLaser.x + bossLaser.width){ lives--; spawnHitParticles(player.x,player.y,12); if(lives<=0) endGame(); bossLaser=null; } if(bossLaser.x > WIDTH+200) bossLaser=null; }
  }
}

function applyBlackHole(hole, dt){
  const dx = hole.x - player.x; const dy = hole.y - player.y;
  const dist = Math.max(20, Math.hypot(dx,dy));
  const force = hole.pull * 400 * dt;
  player.x += (dx/dist) * force;
  spawnParticlesAt(hole.x + (Math.random()*80-40), hole.y + (Math.random()*80-40), 1, '#7b2aff');
}

function spawnParticlesAt(x,y,n,col){
  for(let i=0;i<n;i++) particles.push({ x:x+(Math.random()*24-12), y:y+(Math.random()*24-12), size:Math.random()*4+1, alpha:1, vy:Math.random()*0.8+0.2, col:col||player.color });
}

function updateAfterimages(dt){
  for(let i=afterimages.length-1;i>=0;i--){ afterimages[i].life -= dt; afterimages[i].alpha -= dt*2.6; if(afterimages[i].life<=0) afterimages.splice(i,1); }
}

function updateCurseZones(dt){
  for(let i=curseZones.length-1;i>=0;i--){
    const z = curseZones[i]; z.y += z.riseSpeed*dt; z.timer--; if(z.timer<=0) curseZones.splice(i,1);
    const dx = player.x - z.x; const dy = player.y - z.y; if(Math.abs(dx) < z.w/2 && Math.abs(dy) < z.h/2){ lives -= 0.02; if(lives<=0) endGame(); spawnHitParticles(player.x,player.y,1); }
  }
}

function updateGravity(dt){
  if(!gravityActive) return;
  gravityTimer--; const g = gravitySource; if(!g){ gravityActive=false; return; }
  const dx = g.x - player.x; const dy = g.y - player.y; const dist = Math.max(10, Math.hypot(dx,dy));
  player.x += (dx/dist) * Math.min(380, 200 + level*20) * dt;
  if(gravityTimer <=0) gravityActive=false;
}

function bossDies(){
  spawnParticlesAt(boss.x,boss.y,60); score += 60 + level*12; timeLeft += 12 + level*3; enemySpeedMultiplier += 0.4; spawnInterval = Math.max(0.22, spawnInterval*0.86); boss=null; player.color=player.baseColor;
}

function updateTimer(dt){ timeLeft -= dt; if(timeLeft <=0){ timeLeft =0; endGame(); } }
function updateLevel(){ if(score >= nextLevelScore){ level++; nextLevelScore += 50 + level*15; enemySpeedMultiplier += 0.28; spawnInterval = Math.max(0.3, spawnInterval*0.9); } }
function updateHUD(){ scoreTag.textContent = `Score: ${Math.floor(score)}`; levelTag.textContent = `Level: ${level}`; livesTag.textContent = `Lives: ${'❤'.repeat(Math.max(0,Math.floor(lives)))}`; timeTag.textContent = `Time: ${Math.ceil(timeLeft)}s`; }

function endGame(){ running=false; draw(); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,WIDTH,HEIGHT); ctx.fillStyle='white'; ctx.font='36px monospace'; ctx.textAlign='center'; ctx.fillText('Game Over', WIDTH/2, HEIGHT/2 - 20); ctx.font='18px monospace'; ctx.fillText(`Final Score: ${Math.floor(score)}`, WIDTH/2, HEIGHT/2 + 18); restartBtn.disabled=false; }

function draw(){
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  const shakeX = boss && boss.shake ? (Math.random()-0.5)*boss.shake*12 : 0;
  const shakeY = boss && boss.shake ? (Math.random()-0.5)*boss.shake*8 : 0;
  ctx.save(); ctx.translate(shakeX,shakeY);
  ctx.fillStyle='#031024'; ctx.fillRect(0,0,WIDTH,HEIGHT);
  drawBackgroundVoid();
  drawAfterimages();
  drawTrail();
  drawParticles();
  drawBullets();
  drawEnemies();
  drawBoss();
  drawBossBulletsAndLaser();
  drawCurseZones();
  drawPlayer();
  drawHUDOverlay();
  ctx.restore();
}

function drawBackgroundVoid(){
  const g = ctx.createRadialGradient(WIDTH/2, HEIGHT/3, 10, WIDTH/2, HEIGHT/3, WIDTH);
  g.addColorStop(0,'rgba(40,0,50,0.7)'); g.addColorStop(1,'rgba(0,0,0,0.0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,WIDTH,HEIGHT);
}

function drawPlayer(){
  const pulse = Math.sin(player.animPulse) * 4;
  const vibrX = (Math.random()-0.5)*0.8;
  const vibrY = (Math.random()-0.5)*0.8;
  ctx.save();
  ctx.shadowBlur = 36; ctx.shadowColor = player.color;
  ctx.fillStyle = player.color;
  ctx.beginPath(); ctx.arc(player.x+vibrX, player.y+vibrY, player.radius + pulse, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.save(); const angle = player.animPulse*0.9; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(player.x+Math.cos(angle)*(player.radius+16), player.y+Math.sin(angle)*(player.radius+16), 6, 0, Math.PI*2); ctx.fillStyle = player.color; ctx.fill(); ctx.restore();
}

function drawTrail(){ ctx.save(); for(let t of player.trail){ ctx.globalAlpha = t.alpha; ctx.beginPath(); ctx.arc(t.x, t.y, t.r,0,Math.PI*2); ctx.fillStyle = player.color; ctx.fill(); } ctx.restore(); }
function drawParticles(){ for(let p of particles){ ctx.save(); ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fillStyle = p.col||player.color; ctx.fill(); ctx.restore(); } }
function drawBullets(){ ctx.save(); for(let b of bullets){ ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fillStyle='#9be7ff'; ctx.fill(); } ctx.restore(); }
function drawEnemies(){ for(let e of enemies){ ctx.save(); if(e.fake){ ctx.globalAlpha = 0.36; ctx.fillStyle = e.color; } else { ctx.shadowBlur = 18; ctx.shadowColor = e.color; ctx.fillStyle = e.color; } ctx.beginPath(); ctx.arc(e.x,e.y,e.radius,0,Math.PI*2); ctx.fill(); ctx.restore(); } }
function drawAfterimages(){ for(let a of afterimages){ ctx.save(); ctx.globalAlpha = a.alpha; ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,Math.PI*2); ctx.fillStyle = 'rgba(120,0,160,0.25)'; ctx.fill(); ctx.restore(); } }

function drawBoss(){
  if(!boss) return;
  ctx.save();
  ctx.shadowBlur = 80; ctx.shadowColor = 'purple';
  ctx.fillStyle = boss.color; ctx.beginPath(); ctx.arc(boss.x,boss.y,boss.radius,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.fillStyle='red'; ctx.beginPath(); ctx.arc(boss.x-26,boss.y-26,12,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(boss.x+26,boss.y-26,12,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle='rgba(120,0,160,0.12)'; ctx.beginPath(); ctx.arc(boss.x,boss.y,boss.radius+18+Math.sin(boss.auraPhase)*8,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(boss.x-90,boss.y-boss.radius-22,180,10); ctx.fillStyle='magenta'; ctx.fillRect(boss.x-90,boss.y-boss.radius-22,180*Math.max(0,boss.hp/boss.maxHp),10); ctx.restore();
}

function drawBossBulletsAndLaser(){
  for(let m of bossBullets){
    ctx.save();
    if(m.type==='bullethell'){ ctx.shadowBlur=18; ctx.shadowColor='rgba(255,120,120,0.9)'; ctx.fillStyle='#ff8f8f'; ctx.beginPath(); ctx.arc(m.x,m.y,m.size,0,Math.PI*2); ctx.fill(); }
    else if(m.type==='orb'){ ctx.shadowBlur=22; ctx.shadowColor='purple'; ctx.fillStyle='#b763ff'; ctx.beginPath(); ctx.arc(m.x,m.y,m.size,0,Math.PI*2); ctx.fill(); }
    else if(m.type==='meteor'){ ctx.shadowBlur=30; ctx.shadowColor='orange'; ctx.fillStyle='#8b2a2a'; ctx.beginPath(); ctx.arc(m.x,m.y,m.size,0,Math.PI*2); ctx.fill(); }
    else if(m.type==='blackhole'){ ctx.globalAlpha = 0.9; const hole=m.hole; const grd=ctx.createRadialGradient(hole.x,hole.y,10,hole.x,hole.y,hole.radius); grd.addColorStop(0,'rgba(120,0,160,1)'); grd.addColorStop(1,'rgba(0,0,0,0.0)'); ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(hole.x,hole.y,hole.radius,0,Math.PI*2); ctx.fill(); }
    else if(m.type==='chaos'){ ctx.shadowBlur=16; ctx.shadowColor='magenta'; ctx.fillStyle='#ff7bff'; ctx.beginPath(); ctx.arc(m.x,m.y,m.size,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }
  if(bossLaser){ ctx.save(); ctx.globalAlpha = bossLaser.charging?0.6:0.95; ctx.fillStyle = bossLaser.charging? 'rgba(255,180,40,0.9)' : 'rgba(200,30,30,0.95)'; ctx.fillRect(bossLaser.x,bossLaser.y,bossLaser.width,bossLaser.height); ctx.restore(); }
}

function drawCurseZones(){ for(let z of curseZones){ ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = z.color; ctx.fillRect(z.x - z.w/2, z.y - z.h/2, z.w, z.h); ctx.restore(); } }

function drawHUDOverlay(){
  ctx.save();
  ctx.fillStyle='rgba(255,255,255,0.02)'; ctx.fillRect(10,10,320,110);
  ctx.fillStyle='white'; ctx.font='18px monospace'; ctx.textAlign='left';
  ctx.fillText(`Score: ${Math.floor(score)}`, 18, 40); ctx.fillText(`Lives: ${'❤'.repeat(Math.max(0,Math.floor(lives)))}`, 18, 68); ctx.fillText(`Time: ${Math.ceil(timeLeft)}s`, 18, 96);
  ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(WIDTH-190,12,170,44);
  ctx.fillStyle='white'; ctx.textAlign='right'; ctx.fillText(`Level ${level}`, WIDTH-20, 40);
  ctx.restore();
}

resetGame();
resizeCanvasToDisplay();
