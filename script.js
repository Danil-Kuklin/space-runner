const gw = document.getElementById('gw');
    const cv = document.getElementById('gc');
    const ctx = cv.getContext('2d');
    const ov = document.getElementById('ov');
    const rbtn = document.getElementById('rbtn');
    const onrEl = document.getElementById('onr');
    const os2 = document.getElementById('os2');

    let W = 0, H = 0, dpr = 1, LANES = 8, laneW = 1;
    const PLANE = { x: 0, y: 0, w: 44, h: 56 };
    let bullets = [], score = 0, state = 'idle';
    let lastTime = 0, spawnAcc = 0, elapsed = 0;
    let touchX = null, touchY = null;
    function fingerOffset() { return Math.round(Math.min(Math.max(H * 0.08, 44), 72)); }
    let best = parseInt(localStorage.getItem('pd_best_arcade') || localStorage.getItem('pd_best') || '0');

    let particles = [];
    let shockwave = null;
    let flashAlpha = 0;
    let dying = false;

    const SHIELD_DURATION = 3.0;
    let shieldActive = false;
    let shieldTimer = 0;
    let shieldPickups = [];
    let shieldSpawnAcc = 0;
    const SHIELD_SPAWN_INTERVAL = 12;

    const SCORE_STAR_VALUE = 20;
    const SCORE_STAR_SPAWN = {
      minScore: 150,
      rollEvery: 0.85,
      minGap: 18,
      softGap: 30,
      hardGap: 48,
      baseChance: 0.10,
      boostedChance: 0.28
    };

    let scoreStars = [];
    let scoreStarRollAcc = 0;
    let lastScoreStarSpawnTime = -999;
    let lastScoreStarPickupTime = -999;
    let floatingTexts = [];

    const TRIAL_SCORE_TRIGGER = 250;
    let trialTriggered = false;
    let trialActive = false;
    let trialStep = 0;
    let trialWait = 0;
    let trialNoticeTimer = 0;
    let trialOrder = [];

    const meteorImg = new Image(); meteorImg.src = 'img/meteor1.png'; let meteorLoaded = false; meteorImg.onload = () => meteorLoaded = true;
    const planeImg = new Image(); planeImg.src = 'img/skin1.png'; let planeLoaded = false; planeImg.onload = () => planeLoaded = true;
    const shieldImg = new Image(); shieldImg.src = 'img/shield1.png'; let shieldImgLoaded = false; shieldImg.onload = () => shieldImgLoaded = true;

    function recalcScale() {
      LANES = W < 390 ? 7 : 8;
      laneW = W / LANES;
      PLANE.w = Math.max(38, Math.min(64, laneW * 0.92));
      PLANE.h = Math.max(50, Math.min(82, laneW * 1.18));
    }

    function resize() {
      const oldW = W || 1, oldH = H || 1;
      W = Math.max(1, Math.round(gw.clientWidth));
      H = Math.max(1, Math.round(gw.clientHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      recalcScale();
      if (oldW > 1 && oldH > 1) {
        PLANE.x *= W / oldW; PLANE.y *= H / oldH;
        for (const b of bullets) { b.x *= W / oldW; b.y *= H / oldH; b.r = Math.max(12, Math.min(25, laneW * 0.28)); }
        for (const p of particles) { p.x *= W / oldW; p.y *= H / oldH; }
        for (const s of shieldPickups) { s.x *= W / oldW; s.y *= H / oldH; }
        for (const st of scoreStars) { st.x *= W / oldW; st.y *= H / oldH; }
        for (const t of floatingTexts) { t.x *= W / oldW; t.y *= H / oldH; }
        if (shockwave) { shockwave.x *= W / oldW; shockwave.y *= H / oldH; }
      }
    }
    resize();

    function bulletRadius() { return Math.max(13, Math.min(24, laneW * 0.30)); }
    function bulletSpeed() { return Math.min(H * 0.92, H * (0.54 + elapsed * 0.010) + Math.sqrt(score) * 9); }
    function spawnInterval() { return Math.max(0.12, 0.32 - elapsed * 0.003); }

    function startGame() {
      recalcScale();
      PLANE.x = W / 2; PLANE.y = H * 0.80;
      bullets = []; score = 0; elapsed = 0; spawnAcc = 999;
      particles = []; shockwave = null; flashAlpha = 0; dying = false;
      shieldActive = false; shieldTimer = 0; shieldPickups = []; shieldSpawnAcc = 0;
      scoreStars = []; scoreStarRollAcc = 0; lastScoreStarSpawnTime = -999; lastScoreStarPickupTime = -999; floatingTexts = [];
      trialTriggered = false; trialActive = false; trialStep = 0; trialWait = 0; trialNoticeTimer = 0; trialOrder = [];
      touchX = null; touchY = null;
      ov.classList.add('hide');
      state = 'playing'; lastTime = 0;
      requestAnimationFrame(loop);
    }

    function spawnExplosion(x, y, { gold = false, small = false } = {}) {
      if (!gold) {
        shockwave = { x, y, r: 10, maxR: Math.max(W, H) * 0.55, alpha: 1 };
        flashAlpha = 0.85;
      }
      const count = gold ? 28 : 48;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const layer = i % 3;
        const spd = gold
          ? (layer === 0 ? 4 + Math.random() * 5 : layer === 1 ? 2 + Math.random() * 3 : 0.5 + Math.random() * 2)
          : (layer === 0 ? 3 + Math.random() * 7 : layer === 1 ? 1.5 + Math.random() * 4 : 0.5 + Math.random() * 2);
        const hue = gold
          ? (layer === 0 ? 45 + Math.random() * 15 : layer === 1 ? 35 + Math.random() * 20 : 50 + Math.random() * 20)
          : (layer === 0 ? 40 + Math.random() * 30 : layer === 1 ? 10 + Math.random() * 30 : 200 + Math.random() * 60);
        const sat = gold ? 100 : (layer === 2 ? 60 : 100);
        const lum = gold ? (layer === 0 ? 85 : 70) : (layer === 0 ? 80 : 60);
        const size = small
          ? (layer === 0 ? 1.5 + Math.random() * 2 : layer === 1 ? 2 + Math.random() * 4 : 1 + Math.random() * 2)
          : (layer === 0 ? 2 + Math.random() * 3 : layer === 1 ? 4 + Math.random() * 7 : 2 + Math.random() * 4);
        const decay = layer === 0 ? 0.020 + Math.random() * 0.022
          : layer === 1 ? 0.012 + Math.random() * 0.016
            : 0.009 + Math.random() * 0.013;
        particles.push({
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - (layer === 0 ? 2 : 0.5),
          r: size, life: 1, decay,
          trail: layer === 1 && !gold,
          hue, sat, lum,
        });
      }
      if (!gold) {
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.4 + Math.random() * 1.5;
          particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 0.3,
            r: 8 + Math.random() * 14,
            life: 1, decay: 0.006 + Math.random() * 0.008,
            smoke: true, hue: 0, sat: 0, lum: 70,
          });
        }
      }
    }

    function endGame() {
      dying = true;
      spawnExplosion(PLANE.x, PLANE.y);
      setTimeout(() => {
        state = 'gameover';
        const isNew = score > best;
        if (isNew) { best = score; localStorage.setItem('pd_best_arcade', best); }
        os2.textContent = 'Счёт: ' + score + '   Рекорд: ' + best;
        onrEl.style.display = isNew ? 'block' : 'none';
        rbtn.textContent = '↺ РЕСТАРТ';
        ov.classList.remove('hide');
      }, 900);
    }

    function shieldPickupRadius() { return Math.max(16, Math.min(26, laneW * 0.34)); }

    function spawnShieldPickup() {
      const r = shieldPickupRadius();
      const margin = r + 8;
      const x = margin + Math.random() * (W - margin * 2);
      const spd = bulletSpeed() * 1.12;
      shieldPickups.push({ x, y: -r, r, speed: spd, angle: 0 });
    }

    function scoreStarRadius() { return Math.max(15, Math.min(25, laneW * 0.32)); }

    function spawnScoreStar() {
      const r = scoreStarRadius();
      const margin = r + 10;
      const x = margin + Math.random() * Math.max(1, W - margin * 2);
      const spd = bulletSpeed() * 0.82;
      scoreStars.push({ x, y: -r, r, speed: spd, angle: Math.random() * Math.PI * 2, pulse: Math.random() * Math.PI * 2 });
      lastScoreStarSpawnTime = elapsed;
    }

    function updateScoreStarSpawner(dt) {
      if (state !== 'playing' || dying) return;
      if (score < SCORE_STAR_SPAWN.minScore) return;
      if (scoreStars.length > 0) return;

      scoreStarRollAcc += dt;
      if (scoreStarRollAcc < SCORE_STAR_SPAWN.rollEvery) return;
      scoreStarRollAcc = 0;

      const sinceSpawn = elapsed - lastScoreStarSpawnTime;
      const sincePickup = elapsed - lastScoreStarPickupTime;
      const sinceAny = Math.min(sinceSpawn, sincePickup);

      if (sinceAny < SCORE_STAR_SPAWN.minGap) return;

      let chance = SCORE_STAR_SPAWN.baseChance;
      if (sinceAny >= SCORE_STAR_SPAWN.softGap) chance = SCORE_STAR_SPAWN.boostedChance;
      if (sinceAny >= SCORE_STAR_SPAWN.hardGap) chance = 1;

      if (Math.random() < chance) spawnScoreStar();
    }

    function spawnScoreStarSparkles(x, y) {
      for (let i = 0; i < 22; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.2 + Math.random() * 4.5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 0.8,
          r: 1.5 + Math.random() * 3.5,
          life: 1,
          decay: 0.025 + Math.random() * 0.025,
          hue: 42 + Math.random() * 18,
          sat: 100,
          lum: 72 + Math.random() * 18,
          trail: false
        });
      }

      floatingTexts.push({
        x,
        y: y - 8,
        text: '+' + SCORE_STAR_VALUE,
        life: 1,
        vy: -38
      });
    }

    function drawShieldPickup(s) {
      ctx.save();
      ctx.translate(s.x, s.y);
      s.angle = (s.angle || 0) + 0.04;
      if (shieldImgLoaded) {
        ctx.shadowColor = 'rgba(100,180,255,0.9)';
        ctx.shadowBlur = 18;
        ctx.drawImage(shieldImg, -s.r, -s.r, s.r * 2, s.r * 2);
      } else {
        ctx.rotate(s.angle);
        ctx.shadowColor = 'rgba(100,200,255,0.8)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(0, -s.r);
        ctx.lineTo(s.r * 0.8, -s.r * 0.4);
        ctx.lineTo(s.r * 0.65, s.r * 0.55);
        ctx.lineTo(0, s.r * 0.95);
        ctx.lineTo(-s.r * 0.65, s.r * 0.55);
        ctx.lineTo(-s.r * 0.8, -s.r * 0.4);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -s.r, 0, s.r);
        g.addColorStop(0, '#a8d8ff');
        g.addColorStop(0.45, '#4499ff');
        g.addColorStop(1, '#ffd700');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,80,0.9)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        const sr = s.r * 0.28;
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5 - Math.PI / 2;
          const ia = (i + 0.5) * Math.PI * 2 / 5 - Math.PI / 2;
          i === 0 ? ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr) : ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
          ctx.lineTo(Math.cos(ia) * sr * 0.42, Math.sin(ia) * sr * 0.42);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawScoreStar(st) {
      ctx.save();
      ctx.translate(st.x, st.y);

      st.angle = (st.angle || 0) + 0.055;
      st.pulse = (st.pulse || 0) + 0.10;

      const pulse = 0.88 + Math.sin(st.pulse) * 0.12;
      const outer = st.r * pulse;
      const inner = outer * 0.46;

      ctx.rotate(st.angle);
      ctx.shadowColor = 'rgba(255,215,0,0.95)';
      ctx.shadowBlur = 22;

      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, outer * 1.65);
      halo.addColorStop(0, 'rgba(255,240,120,0.30)');
      halo.addColorStop(0.45, 'rgba(255,180,0,0.18)');
      halo.addColorStop(1, 'rgba(255,180,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, outer * 1.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 - Math.PI / 2;
        const rr = i % 2 === 0 ? outer : inner;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();

      const g = ctx.createLinearGradient(-outer, -outer, outer, outer);
      g.addColorStop(0, '#fff7a8');
      g.addColorStop(0.35, '#ffd700');
      g.addColorStop(0.75, '#ff9f1a');
      g.addColorStop(1, '#fff0a0');
      ctx.fillStyle = g;
      ctx.fill();

      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(255,255,220,0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(-outer * 0.25, -outer * 0.22, Math.max(2, outer * 0.12), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawShieldAura(x, y, t) {
      const pulse = 0.85 + 0.15 * Math.sin(elapsed * 8);
      const r = Math.max(PLANE.w, PLANE.h) * 0.72 * pulse;
      const alpha = Math.min(1, t / 0.5) * 0.82;
      ctx.save();
      ctx.strokeStyle = `rgba(255,215,0,${alpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255,200,50,0.95)';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(100,200,255,${alpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,215,0,${alpha * 0.08})`);
      grd.addColorStop(0.6, `rgba(100,180,255,${alpha * 0.06})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      const pct = t / SHIELD_DURATION;
      ctx.strokeStyle = `rgba(255,215,0,${alpha * 0.5})`;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255,215,0,0.6)';
      ctx.beginPath();
      ctx.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawFallbackPlane(x, y) {
      const hw = PLANE.w / 2, hh = PLANE.h / 2;
      ctx.save(); ctx.translate(x, y);
      ctx.shadowColor = 'rgba(120,200,255,0.45)'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -hh); ctx.lineTo(hw * 0.58, hh * 0.36); ctx.lineTo(0, hh * 0.12); ctx.lineTo(-hw * 0.58, hh * 0.36);
      ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(hw * 0.58, hh * 0.36); ctx.lineTo(hw, hh); ctx.lineTo(0, hh * 0.15); ctx.lineTo(-hw, hh); ctx.lineTo(-hw * 0.58, hh * 0.36);
      ctx.closePath(); ctx.fillStyle = '#c9dcff'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, -hh * 0.18, Math.max(4, PLANE.w * 0.11), 0, Math.PI * 2);
      ctx.fillStyle = '#80d7ff'; ctx.fill();
      ctx.fillStyle = 'rgba(80,160,255,0.55)';
      ctx.fillRect(-hw * 0.14, hh * 0.35, hw * 0.28, hh * 0.32);
      ctx.restore();
    }

    function drawPlane(x, y) {
      if (!planeLoaded) { drawFallbackPlane(x, y); return; }
      ctx.save();
      ctx.drawImage(planeImg, x - PLANE.w / 2, y - PLANE.h / 2, PLANE.w, PLANE.h);
      ctx.restore();
    }

    function drawBullet(b) {
      if (meteorLoaded) {
        ctx.save();
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(255,80,80,0.7)';
        ctx.drawImage(meteorImg, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = 'rgba(255,70,70,0.65)'; ctx.shadowBlur = b.r * 0.8;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, 0, b.x, b.y, b.r);
        grad.addColorStop(0, '#ffd0a0'); grad.addColorStop(0.35, '#ff5d5d'); grad.addColorStop(1, '#a92424');
        ctx.fillStyle = grad; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }

    function drawFloatingTexts(dt) {
      for (const t of floatingTexts) {
        t.y += t.vy * dt;
        t.life -= dt * 1.7;
      }

      for (const t of floatingTexts) {
        if (t.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.life);
        ctx.fillStyle = 'rgba(255,215,0,0.95)';
        ctx.shadowColor = 'rgba(255,200,30,0.9)';
        ctx.shadowBlur = 12;
        ctx.font = 'bold ' + Math.max(18, Math.min(28, W * 0.055)) + 'px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }

      floatingTexts = floatingTexts.filter(t => t.life > 0);
    }

    function drawHUD() {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = 'bold ' + Math.max(17, Math.min(23, W * 0.045)) + 'px "Courier New"';
      ctx.textAlign = 'left'; ctx.fillText('SCORE ' + score, 14, 32);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = Math.max(13, Math.min(18, W * 0.035)) + 'px "Courier New"';
      ctx.fillText('BEST ' + best, W - 14, 32);
      const pct = Math.min((bulletSpeed() - H * 0.54) / (H * 0.38), 1);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(14, H - 20, W - 28, 7);
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(14, H - 20, Math.round((W - 28) * pct), 7);
      if (shieldActive) {
        const tx = W / 2, ty = 14;
        ctx.fillStyle = 'rgba(255,215,0,0.9)';
        ctx.font = 'bold 13px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('🛡 ' + shieldTimer.toFixed(1) + 's', tx, ty + 8);
      }
    }

    function drawStars() {
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      for (let i = 0; i < 70; i++) {
        const sx = (i * 73 + elapsed * 18 * (i % 3 === 0 ? 0.7 : 0.28)) % W;
        const sy = (i * 137 + elapsed * 80 * (i % 2 === 0 ? 1 : 0.55)) % H;
        ctx.fillRect(Math.round(sx), Math.round(sy), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }
    }

    function drawExplosionFX(dt) {
      if (shockwave) {
        shockwave.r += Math.min(shockwave.maxR * 0.08, (shockwave.maxR - shockwave.r) * 0.22 + 18);
        shockwave.alpha = Math.max(0, shockwave.alpha - dt * 2.8);
        if (shockwave.alpha > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,200,100,${shockwave.alpha})`;
          ctx.lineWidth = Math.max(1, 6 * (1 - shockwave.r / shockwave.maxR));
          ctx.shadowColor = `rgba(255,150,50,${shockwave.alpha})`;
          ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.arc(shockwave.x, shockwave.y, shockwave.r, 0, Math.PI * 2); ctx.stroke();
          if (shockwave.r > 40) {
            ctx.strokeStyle = `rgba(255,255,255,${shockwave.alpha * 0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(shockwave.x, shockwave.y, shockwave.r * 0.6, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
        } else { shockwave = null; }
      }

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.smoke) { p.vx *= 0.97; p.vy *= 0.97; p.r += 0.3; }
        else { p.vy += p.trail ? 0.18 : 0.12; p.vx *= 0.99; }
        p.life -= p.decay;
      }

      for (const p of particles) {
        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.smoke ? p.life * 0.25 : p.life;
        if (p.smoke) {
          ctx.fillStyle = `rgba(180,180,180,${p.life * 0.18})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.shadowColor = `hsl(${p.hue},${p.sat}%,${p.lum}%)`;
          ctx.shadowBlur = p.trail ? 10 : 5;
          ctx.fillStyle = `hsl(${p.hue},${p.sat}%,${p.lum}%)`;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2); ctx.fill();
          if (p.trail && p.life > 0.3) {
            ctx.strokeStyle = `hsla(${p.hue},${p.sat}%,${p.lum}%,${p.life * 0.5})`;
            ctx.lineWidth = p.r * 0.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4); ctx.stroke();
          }
        }
        ctx.restore();
      }
      particles = particles.filter(p => p.life > 0);

      if (flashAlpha > 0) {
        flashAlpha = Math.max(0, flashAlpha - dt * 4.5);
        if (flashAlpha > 0) { ctx.fillStyle = `rgba(255,220,150,${flashAlpha})`; ctx.fillRect(0, 0, W, H); }
      }
    }

    function findSpawnX(r) {
      const margin = r + 4;
      for (let attempt = 0; attempt < 10; attempt++) {
        const x = margin + Math.random() * Math.max(1, W - margin * 2);
        const tooClose = bullets.some(b => b.y < H * 0.25 && Math.abs(b.x - x) < r * 2.15);
        if (!tooClose) return x;
      }
      return margin + Math.random() * Math.max(1, W - margin * 2);
    }

    function spawnBullet() {
      const r = bulletRadius();
      bullets.push({ x: findSpawnX(r), y: -r, r, speed: bulletSpeed() * (0.92 + Math.random() * 0.18), scored: false });
    }

    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function trialDelay() {
      return 0.58;
    }

    function startTrial() {
      trialTriggered = true;
      trialActive = true;
      trialStep = 0;
      trialWait = 0;
      trialNoticeTimer = 1.8;

      trialOrder = shuffleArray([0, 1, 2, 3, 4, 5, 6]);

      spawnAcc = 0;
    }

    function spawnMeteorRow(xMin, xMax, count = 5) {
      const r = bulletRadius();
      const minX = Math.max(r + 6, xMin + r + 6);
      const maxX = Math.min(W - r - 6, xMax - r - 6);
      if (maxX <= minX) return;

      const actualCount = Math.max(1, count);
      const spd = bulletSpeed() * 0.92;

      for (let i = 0; i < actualCount; i++) {
        const t = actualCount === 1 ? 0.5 : i / (actualCount - 1);
        const x = minX + (maxX - minX) * t;
        bullets.push({
          x,
          y: -r,
          r,
          speed: spd,
          scored: false,
          trial: true
        });
      }
    }

    function spawnRowWithGap(gapStart, gapEnd, count = 8) {
      const r = bulletRadius();
      const spd = bulletSpeed() * 0.92;
      const margin = r + 6;
      const minX = margin;
      const maxX = W - margin;

      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const x = minX + (maxX - minX) * t;

        if (x >= gapStart && x <= gapEnd) continue;

        bullets.push({
          x,
          y: -r,
          r,
          speed: spd,
          scored: false,
          trial: true
        });
      }
    }

    function spawnTrialPattern(patternId) {
      const halfCount = W < 390 ? 4 : 5;
      const thirdCount = W < 390 ? 3 : 4;
      const fullCount = W < 390 ? 7 : 8;
      const safeWide = Math.max(PLANE.w * 1.75, W * 0.24);
      const safeNormal = Math.max(PLANE.w * 1.55, W * 0.20);

      if (patternId === 0) 
      {
        spawnMeteorRow(W / 2, W, halfCount);
      } 
      else if (patternId === 1)
      {
        spawnMeteorRow(0, W / 2, halfCount);
      } 
      else if (patternId === 2) 
      {
        spawnMeteorRow(0, W / 3, thirdCount);
        spawnMeteorRow(W * 2 / 3, W, thirdCount);

      } 
      else if (patternId === 3)
      {
        spawnMeteorRow(W / 3, W * 2 / 3, thirdCount);

      } 
      else if (patternId === 4) 
      {
        const center = W * 0.22;
        spawnRowWithGap(center - safeNormal / 2, center + safeNormal / 2, fullCount);

      } 
      else if (patternId === 5) 
      {
        const center = W * 0.78;
        spawnRowWithGap(center - safeNormal / 2, center + safeNormal / 2, fullCount);

      } 
      else if (patternId === 6) 
      {
        const center = W * 0.5;
        spawnRowWithGap(center - safeWide / 2, center + safeWide / 2, fullCount);
      }
    }

    function updateTrial(dt) {
      if (!trialActive) return;

      trialWait -= dt;
      if (trialWait > 0) return;

      if (trialStep >= trialOrder.length) {
        trialActive = false;
        trialWait = 0;
        spawnAcc = 0;
        return;
      }

      spawnTrialPattern(trialOrder[trialStep]);
      trialStep++;
      trialWait = trialDelay();
    }

    function drawTrialNotice(dt) {
      if (trialNoticeTimer <= 0) return;
      trialNoticeTimer = Math.max(0, trialNoticeTimer - dt);

      const alpha = Math.min(1, trialNoticeTimer / 0.35);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = 'bold ' + Math.max(18, Math.min(30, W * 0.065)) + 'px "Courier New"';
      ctx.fillStyle = 'rgba(255,215,0,0.95)';
      ctx.shadowColor = 'rgba(255,120,20,0.9)';
      ctx.shadowBlur = 18;
      ctx.fillText('ИСПЫТАНИЕ!', W / 2, H * 0.18);
      ctx.font = 'bold ' + Math.max(12, Math.min(17, W * 0.038)) + 'px "Courier New"';
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.shadowBlur = 8;
      ctx.fillText('держи проход, пилот', W / 2, H * 0.18 + 26);
      ctx.restore();
    }

    function pointerToGame(clientX, clientY) {
      const rect = cv.getBoundingClientRect();
      return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
    }

    function loop(ts) {
      if (state !== 'playing' && !dying) return;
      if (!lastTime) lastTime = ts;
      const dt = Math.min(ts - lastTime, 50) / 1000;
      lastTime = ts;

      ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, H);
      drawStars();

      if (state === 'playing' && !dying) {
        elapsed += dt;

        if (!trialTriggered && score >= TRIAL_SCORE_TRIGGER) {
          startTrial();
        }
        updateTrial(dt);

        if (touchX !== null) {
          const targetX = touchX;
          const targetY = touchY - fingerOffset();
          const dx = targetX - PLANE.x, dy = targetY - PLANE.y;
          const follow = Math.min(1, dt * 13);
          PLANE.x += dx * follow; PLANE.y += dy * follow;
          PLANE.x = Math.max(PLANE.w / 2, Math.min(W - PLANE.w / 2, PLANE.x));
          PLANE.y = Math.max(PLANE.h / 2, Math.min(H - PLANE.h / 2, PLANE.y));
        }

        if (!trialActive) {
          spawnAcc += dt;
          if (spawnAcc >= spawnInterval()) { spawnBullet(); spawnAcc = 0; }
        } else {
          spawnAcc = 0;
        }

        shieldSpawnAcc += dt;
        if (shieldSpawnAcc >= SHIELD_SPAWN_INTERVAL) {
          spawnShieldPickup();
          shieldSpawnAcc = 0;
        }

        updateScoreStarSpawner(dt);

        if (shieldActive) {
          shieldTimer -= dt;
          if (shieldTimer <= 0) { shieldActive = false; shieldTimer = 0; }
        }

        let hit = false;
        for (const b of bullets) {
          b.y += b.speed * dt;
          if (!b.scored && b.y > H + b.r) { b.scored = true; score++; }
          const dx = b.x - PLANE.x, dy = b.y - PLANE.y;
          const planeHit = Math.min(PLANE.w, PLANE.h) * 0.34;
          if (Math.sqrt(dx * dx + dy * dy) < b.r + planeHit) {
            if (shieldActive) {
              shieldActive = false;
              shieldTimer = 0;
              spawnExplosion(PLANE.x, PLANE.y, { gold: true, small: true });
              b.scored = true; b.y = H + 999;
            } else {
              hit = true;
            }
            break;
          }
        }
        if (hit) { endGame(); }

        bullets = bullets.filter(b => b.y < H + b.r + 80);

        for (const s of shieldPickups) {
          s.y += s.speed * dt;
          const dx = s.x - PLANE.x, dy = s.y - PLANE.y;
          const hitR = s.r + Math.min(PLANE.w, PLANE.h) * 0.38;
          if (Math.sqrt(dx * dx + dy * dy) < hitR) {
            shieldActive = true;
            shieldTimer = SHIELD_DURATION;
            s.collected = true;
          }
        }
        shieldPickups = shieldPickups.filter(s => s.y < H + 60 && !s.collected);

        for (const st of scoreStars) {
          st.y += st.speed * dt;
          const dx = st.x - PLANE.x, dy = st.y - PLANE.y;
          const hitR = st.r + Math.min(PLANE.w, PLANE.h) * 0.36;
          if (Math.sqrt(dx * dx + dy * dy) < hitR) {
            score += SCORE_STAR_VALUE;
            lastScoreStarPickupTime = elapsed;
            st.collected = true;
            spawnScoreStarSparkles(st.x, st.y);
          }
        }
        scoreStars = scoreStars.filter(st => st.y < H + 70 && !st.collected);

      } else if (dying) {
        for (const b of bullets) { b.y += b.speed * dt; }
        bullets = bullets.filter(b => b.y < H + b.r + 80);
        for (const s of shieldPickups) { s.y += s.speed * dt; }
        shieldPickups = shieldPickups.filter(s => s.y < H + 60);
        for (const st of scoreStars) { st.y += st.speed * dt; }
        scoreStars = scoreStars.filter(st => st.y < H + 70);
      }

      for (const b of bullets) drawBullet(b);
      for (const s of shieldPickups) drawShieldPickup(s);
      for (const st of scoreStars) drawScoreStar(st);

      if (!dying) {
        if (shieldActive) drawShieldAura(PLANE.x, PLANE.y, shieldTimer);
        drawPlane(PLANE.x, PLANE.y);
      }

      drawExplosionFX(dt);
      drawFloatingTexts(dt);
      drawTrialNotice(dt);
      drawHUD();
      requestAnimationFrame(loop);
    }

    gw.addEventListener('touchstart', e => {
      e.preventDefault(); const t = e.touches[0]; const p = pointerToGame(t.clientX, t.clientY); touchX = p.x; touchY = p.y;
      if (state === 'playing' && !dying) 
      {
        PLANE.x = Math.max(PLANE.w / 2, Math.min(W - PLANE.w / 2, p.x)); 
        PLANE.y = Math.max(PLANE.h / 2, Math.min(H - PLANE.h / 2, p.y - fingerOffset())); 
      }
    }, { passive: false });
    gw.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; const p = pointerToGame(t.clientX, t.clientY); touchX = p.x; touchY = p.y; }, { passive: false });
    gw.addEventListener('touchend', e => { e.preventDefault(); touchX = null; touchY = null; }, { passive: false });
    gw.addEventListener('mousemove', e => { if (state !== 'playing') return; const p = pointerToGame(e.clientX, e.clientY); touchX = p.x; touchY = p.y; });
    gw.addEventListener('mouseleave', () => { touchX = null; touchY = null; });
    rbtn.addEventListener('click', startGame);
    rbtn.addEventListener('touchend', e => { e.preventDefault(); startGame(); });
    window.addEventListener('resize', resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 80));