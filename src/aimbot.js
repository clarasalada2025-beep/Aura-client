/*
 * aimbot.js - modulo de mira SEPARADO do cliente (conecta no menu EagMenu).
 *
 * O que ele faz: dado um alvo na tela, gira a camera ate o alvo ficar no centro (mira),
 * usando movimento de mouse simulado (movementX/movementY) com o mouse preso pelo jogo.
 *
 * O que ele NAO faz sozinho: descobrir onde estao os jogadores/mobs. Isso fica por conta de um
 * "detector" que entrega os alvos. Qualquer detector se conecta assim:
 *
 *     EagAimbot.setTargets([ { x: 640, y: 300, dist: 4.2, name: 'Steve' }, ... ]);
 *
 *   x, y  = posicao do alvo na tela, em pixels CSS da janela (mesmo sistema do clientX/clientY)
 *   dist  = distancia em blocos (opcional; usada para escolher o mais proximo e limitar o alcance)
 *
 * Chame setTargets a cada quadro (ou sempre que os alvos mudarem). Alvos "velhos" (>250 ms) sao ignorados.
 *
 * Sem detector conectado o Aimbot fica ligado mas parado (nao ha o que mirar).
 */
(function () {
  'use strict';
  if (window.EagAimbot) return;

  var targets = [];
  var targetsAt = 0;
  var FAKE = '__eagmFake';

  var api = window.EagAimbot = {
    version: '1.0',
    /** Entrega a lista de alvos (substitui a anterior). */
    setTargets: function (list) {
      targets = Array.isArray(list) ? list.filter(function (t) { return t && isFinite(t.x) && isFinite(t.y); }) : [];
      targetsAt = performance.now();
    },
    hasTargets: function () { return targets.length > 0 && performance.now() - targetsAt < 250; },
    /** true quando algum detector ja entregou alvos alguma vez. */
    detectorConnected: false
  };
  var origSet = api.setTargets;
  api.setTargets = function (l) { api.detectorConnected = true; origSet(l); };

  function settings() {
    var g = window.EagMenu && EagMenu.get('aimbot');
    var s = (g && g.settings) || {};
    return {
      smooth: s.smooth || 40,      // 1..100 (%) quanto corrige por quadro
      fov: s.fov || 60,            // raio (graus) em volta da mira onde ele aceita alvos
      range: s.range || 6,         // alcance em blocos
      sens: (s.sens || 50) / 100,  // sensibilidade do JOGO (Opcoes > Controles), 0..1
      vfov: 70                     // FOV vertical do Minecraft (padrao 70)
    };
  }

  function pick(cfg) {
    var cx = innerWidth / 2, cy = innerHeight / 2;
    var degPerPx = cfg.vfov / innerHeight;
    var best = null, bestScore = Infinity;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t.dist != null && t.dist > cfg.range) continue;
      var dx = t.x - cx, dy = t.y - cy;
      var ang = Math.sqrt(dx * dx + dy * dy) * degPerPx;
      if (ang > cfg.fov) continue;
      // prefere o mais proximo da mira; empata pelo mais perto em blocos
      var score = ang + (t.dist != null ? t.dist * 0.01 : 0);
      if (score < bestScore) { bestScore = score; best = { dx: dx, dy: dy }; }
    }
    return best;
  }

  function moveMouse(el, mx, my) {
    var ev = new MouseEvent('mousemove', {
      bubbles: true, cancelable: true, view: window,
      clientX: innerWidth / 2, clientY: innerHeight / 2,
      movementX: mx, movementY: my
    });
    ev[FAKE] = true;
    el.dispatchEvent(ev);
  }

  function tick(dt) {
    var lock = document.pointerLockElement;
    if (!lock || !api.hasTargets()) return;        // so mira dentro do jogo (mouse preso) e com alvo
    var cfg = settings();
    var t = pick(cfg);
    if (!t) return;
    if (Math.abs(t.dx) < 3 && Math.abs(t.dy) < 3) return;   // ja esta na mira (evita tremer)
    // graus que faltam -> pixels de mouse (Minecraft: graus = pixels * 0.15 * (sens*0.6+0.2)^3 * 8)
    var degPerPx = cfg.vfov / innerHeight;
    var f = Math.pow(cfg.sens * 0.6 + 0.2, 3) * 8 * 0.15;     // graus por pixel de mouse
    var k = (degPerPx / f) * (cfg.smooth / 100);              // fracao corrigida por quadro
    var mx = Math.round(t.dx * k), my = Math.round(t.dy * k);
    if (mx === 0 && my === 0) return;
    moveMouse(lock, mx, my);
  }

  function register() {
    EagMenu.register({
      id: 'aimbot',
      name: 'Aimbot',
      category: 'PvP +',
      settings: [
        { id: 'smooth', label: 'Suavidade', type: 'slider', min: 5, max: 100, step: 5, value: 40 },
        { id: 'fov', label: 'Campo (graus)', type: 'slider', min: 10, max: 90, step: 5, value: 60 },
        { id: 'range', label: 'Alcance (blocos)', type: 'slider', min: 2, max: 10, step: 1, value: 6 },
        { id: 'sens', label: 'Sensib. do jogo (%)', type: 'slider', min: 0, max: 100, step: 5, value: 50 }
      ],
      onEnable: function () {
        EagMenu.notify(api.detectorConnected ? 'Aimbot: ON' : 'Aimbot: ON (sem detector de alvos conectado)');
      },
      onTick: tick
    });
  }

  if (window.EagMenu) register();
  else window.addEventListener('eagmenu-ready', register, { once: true });
})();
