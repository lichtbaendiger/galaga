/* ============================================================
   audio.js – 8-bit-artige Soundausgabe per WebAudio (synthetisch)
   ============================================================ */
window.SND = (function () {
  "use strict";
  var ac = null, master = null, muted = false;
  var noiseBuf = null;
  var beamNodes = null;
  var chalTimer = null;

  function ensure() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.22;
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return true;
  }

  function getNoiseBuf() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  /* Einzelner Ton mit optionalem Frequenz-Sweep */
  function tone(f0, f1, dur, type, vol, delay) {
    if (muted || !ensure()) return;
    var t0 = ac.currentTime + (delay || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, fc, delay) {
    if (muted || !ensure()) return;
    var t0 = ac.currentTime + (delay || 0);
    var s = ac.createBufferSource(); s.buffer = getNoiseBuf();
    var f = ac.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(fc || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(120, t0 + dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }

  /* Note-Sequenz: [[freq, startSek, dauer], ...] */
  function seq(notes, type, vol) {
    if (muted || !ensure()) return;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n[0] > 0) tone(n[0], n[0], n[2] || 0.11, type || "square", vol || 0.28, n[1]);
    }
  }

  var api = {
    unlock: function () { ensure(); },
    toggle: function () {
      muted = !muted;
      if (muted) { api.stopBeam(); api.stopChallenge(); }
      return muted;
    },
    isMuted: function () { return muted; },

    shoot:   function () { tone(1050, 340, 0.08, "square", 0.22); },
    eshoot:  function () { tone(1500, 620, 0.06, "sawtooth", 0.14); },
    eboom:   function () { noise(0.16, 0.3, 1800); tone(520, 110, 0.13, "square", 0.12); },
    boom:    function () { noise(0.3, 0.45, 1100); tone(240, 55, 0.3, "sawtooth", 0.25); },
    click:   function () { tone(1900, 1500, 0.025, "square", 0.09); },
    pop:     function () { tone(700, 1400, 0.05, "square", 0.12); },
    flagHit: function () {
      seq([[880, 0, .09], [1174, .09, .09], [1568, .18, .14]], "square", 0.25);
    },
    extraLife: function () {
      seq([[523, 0, .1], [659, .1, .1], [784, .2, .1], [1046, .3, .22]], "square", 0.3);
    },
    capture: function () {
      api.stopBeam();
      tone(700, 90, 1.0, "sawtooth", 0.28);
      tone(720, 100, 1.0, "square", 0.12);
    },
    rescue: function () {
      seq([[392, 0, .09], [523, .09, .09], [659, .18, .09], [784, .27, .09], [1046, .36, .2]], "triangle", 0.35);
    },
    playerDie: function () {
      noise(0.5, 0.4, 900);
      tone(420, 40, 0.5, "sawtooth", 0.3);
    },
    waveTune: function () { /* eigenes Begrüßungs-Motiv (keine Original-Melodie) */
      var t = 0, step = 0.13;
      seq([
        [659, t, .12], [784, t += step, .12], [880, t += step, .12], [1046, t += step, .2],
        [989, t += step * 1.6, .12], [784, t += step, .12], [659, t += step, .12],
        [587, t += step, .12], [659, t += step, .26]
      ], "square", 0.22);
    },
    startChallenge: function () { /* eigener Marsch für Challenging Stage, loopt bis Wellen-Ende */
      if (muted || !ensure() || chalTimer) return;
      var pattern = [
        [294, 0, .14], [294, .14, .14], [349, .28, .14], [440, .42, .28],
        [392, .7, .14], [349, .84, .14], [294, .98, .28], [262, 1.26, .14],
        [294, 1.4, .28], [0, 1.68, .1]
      ];
      var bass = [
        [147, 0, .2], [147, .28, .2], [175, .56, .2], [175, .84, .2],
        [196, 1.12, .2], [196, 1.4, .2], [147, 1.68, .2]
      ];
      var play = function () {
        seq(pattern, "square", 0.2);
        seq(bass, "triangle", 0.22);
      };
      play();
      chalTimer = setInterval(play, 1900);
    },
    stopChallenge: function () {
      if (chalTimer) { clearInterval(chalTimer); chalTimer = null; }
    },
    gameOver: function () {
      seq([[392, 0, .25], [330, .28, .25], [262, .56, .25], [196, .84, .5]], "triangle", 0.3);
    },
    startBeam: function () {
      if (muted || !ensure() || beamNodes) return;
      var o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      var lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = "sawtooth"; o.frequency.value = 82;
      o2.type = "square"; o2.frequency.value = 123;
      lfo.type = "sine"; lfo.frequency.value = 11;
      lg.gain.value = 0.13;
      g.gain.value = 0.14;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); o2.connect(g); g.connect(master);
      o.start(); o2.start(); lfo.start();
      beamNodes = { o: o, o2: o2, g: g, lfo: lfo };
    },
    stopBeam: function () {
      if (!beamNodes || !ac) return;
      var b = beamNodes; beamNodes = null;
      var t = ac.currentTime;
      b.g.gain.setValueAtTime(b.g.gain.value, t);
      b.g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      b.o.stop(t + 0.15); b.o2.stop(t + 0.15); b.lfo.stop(t + 0.15);
    }
  };
  return api;
})();
