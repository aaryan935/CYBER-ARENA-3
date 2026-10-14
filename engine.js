// Room and round logic. Networking is injected through send(socketId, event, payload)
// so the whole game can be tested without a server.

const {
  ATTACKS, DEFENSES, SYSTEMS, FIT,
  newSystems, freshStats, resolveRound, checkWinner
} = require('./rules');
const { LESSONS, CHALLENGES } = require('./content');
const { botPick, botName } = require('./bots');

const PICK_MS = 20000;
const REVEAL_MS = 9000;
const MAX_ROUNDS = 8;
const MAX_PLAYERS = 8;
const IDLE_ROOM_MS = 10 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const rand = n => Math.floor(Math.random() * n);
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const cleanName = s =>
  String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14) || 'Player';

// Static info sent to every client once on connect.
const META = {
  attacks: Object.fromEntries(Object.entries(ATTACKS).map(([k, v]) => [k, { label: v.label, desc: v.desc }])),
  defenses: DEFENSES,
  systems: SYSTEMS,
  fit: FIT,
  lessons: LESSONS
};

function createEngine(send, opts = {}) {
  const T = Object.assign({ pickMs: PICK_MS, revealMs: REVEAL_MS }, opts);
  const rooms = {};
  const byToken = {};
  let botCounter = 0;
  let pubCounter = 0;

  // ---------- helpers ----------
  const roomOf = token => rooms[byToken[token]];
  const humans = room => Object.values(room.players).filter(p => !p.bot);
  const connectedHumans = room => humans(room).filter(p => p.connected);

  function newRoom() {
    let id;
    do {
      id = Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join('');
    } while (rooms[id]);
    rooms[id] = {
      id, hostPub: null, phase: 'lobby', players: {},
      systems: newSystems(), round: 0, maxRounds: MAX_ROUNDS,
      endsAt: 0, phaseMs: 0, timer: null,
      challenge: null, used: [], lastReveal: null,
      winner: null, breached: null, stats: freshStats(),
      lastActive: Date.now()
    };
    return rooms[id];
  }

  function addPlayer(room, key, name, bot, socketId) {
    const taken = Object.values(room.players).map(p => p.name);
    let finalName = name;
    let n = 2;
    while (taken.includes(finalName)) finalName = name.slice(0, 12) + n++;
    const p = {
      key, pub: 'p' + (++pubCounter), name: finalName, bot, socketId,
      connected: !bot, role: null, pick: null, score: 0,
      challengeDone: false, challengeOk: false, cOk: 0, cTotal: 0
    };
    room.players[key] = p;
    if (!bot) byToken[key] = room.id;
    return p;
  }

  function schedule(room, ms, fn) {
    clearTimeout(room.timer);
    room.endsAt = Date.now() + ms;
    room.phaseMs = ms;
    room.timer = setTimeout(fn, ms);
  }

  function viewFor(room, me) {
    const inPick = room.phase === 'pick' && room.challenge;
    const showReveal = room.phase === 'reveal' || room.phase === 'end';
    return {
      id: room.id,
      phase: room.phase,
      round: room.round,
      maxRounds: room.maxRounds,
      you: me.pub,
      isHost: me.pub === room.hostPub,
      systems: room.systems,
      endsAt: room.endsAt,
      phaseMs: room.phaseMs,
      serverNow: Date.now(),
      players: Object.values(room.players).map(p => ({
        id: p.pub, name: p.name, role: p.role, bot: p.bot,
        connected: p.bot ? true : p.connected,
        score: p.score, locked: !!p.pick, isHost: p.pub === room.hostPub
      })),
      myPick: me.pick,
      challenge: inPick
        ? { q: room.challenge.q, options: room.challenge.options, answered: me.challengeDone }
        : null,
      lastReveal: showReveal && room.lastReveal
        ? Object.assign({}, room.lastReveal, { myChallengeDone: me.challengeDone, myChallengeOk: me.challengeOk })
        : null,
      winner: room.winner,
      breached: room.breached,
      report: room.phase === 'end'
        ? { attacks: room.stats.attacks, me: { cOk: me.cOk, cTotal: me.cTotal } }
        : null
    };
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    for (const p of humans(room)) {
      if (p.connected && p.socketId) send(p.socketId, 'state', viewFor(room, p));
    }
  }

  function nextChallenge(room) {
    let pool = CHALLENGES.map((_, i) => i).filter(i => !room.used.includes(i));
    if (!pool.length) {
      room.used = [];
      pool = CHALLENGES.map((_, i) => i);
    }
    const idx = pool[rand(pool.length)];
    room.used.push(idx);
    const c = CHALLENGES[idx];
    const order = shuffle(c.options.map((o, i) => ({ o, i })));
    return {
      q: c.q,
      options: order.map(x => x.o),
      answer: order.findIndex(x => x.i === c.answer),
      why: c.why
    };
  }

  // ---------- round flow ----------
  function startRound(room) {
    room.round++;
    room.phase = 'pick';
    Object.values(room.players).forEach(p => {
      p.pick = null;
      p.challengeDone = false;
      p.challengeOk = false;
    });
    room.challenge = nextChallenge(room);
    schedule(room, T.pickMs, () => endPick(room));
    broadcast(room);
  }

  function endPick(room) {
    if (room.phase !== 'pick') return;
    clearTimeout(room.timer);

    Object.values(room.players).forEach(p => {
      if (p.bot) {
        p.pick = botPick(p.role, room);
        p.challengeOk = Math.random() < 0.6;
      }
    });

    const results = resolveRound(room, LESSONS);
    const c = room.challenge;
    room.lastReveal = {
      round: room.round,
      results,
      challenge: { q: c.q, answer: c.options[c.answer], why: c.why }
    };

    const w = checkWinner(room.systems, room.round, room.maxRounds);
    room.phase = 'reveal';
    if (w) {
      room.winner = w.winner;
      room.breached = w.breached;
      room.lastReveal.final = true;
      schedule(room, T.revealMs, () => finish(room));
    } else {
      schedule(room, T.revealMs, () => startRound(room));
    }
    broadcast(room);
  }

  function finish(room) {
    room.phase = 'end';
    clearTimeout(room.timer);
    room.timer = null;
    room.endsAt = 0;
    broadcast(room);
  }

  function allLocked(room) {
    const hs = connectedHumans(room);
    return hs.length > 0 && hs.every(p => p.pick);
  }

  function resetMatch(room) {
    room.systems = newSystems();
    room.round = 0;
    room.winner = null;
    room.breached = null;
    room.stats = freshStats();
    room.lastReveal = null;
    room.challenge = null;
    room.used = [];
    Object.values(room.players).forEach(p => {
      p.role = null; p.pick = null; p.score = 0;
      p.challengeDone = false; p.challengeOk = false; p.cOk = 0; p.cTotal = 0;
    });
  }

  function beginMatch(room) {
    resetMatch(room);
    const n = Object.keys(room.players).length;
    const target = Math.max(4, n + (n % 2));
    while (Object.keys(room.players).length < target) {
      const names = Object.values(room.players).map(p => p.name);
      const key = 'bot-' + (++botCounter);
      addPlayer(room, key, botName(names), true, null);
    }
    shuffle(Object.values(room.players)).forEach((p, i) => {
      p.role = i % 2 === 0 ? 'hacker' : 'defender';
    });
    startRound(room);
  }

  function removeFromRoom(token) {
    const room = roomOf(token);
    if (!room) return;
    const p = room.players[token];
    delete room.players[token];
    delete byToken[token];
    if (!humans(room).length) {
      clearTimeout(room.timer);
      delete rooms[room.id];
      return;
    }
    if (p && p.pub === room.hostPub) {
      const next = connectedHumans(room)[0] || humans(room)[0];
      room.hostPub = next.pub;
    }
    broadcast(room);
  }

  // ---------- public API (each returns {ok:true,...} or {error}) ----------
  return {
    rooms,

    createRoom(token, name, socketId) {
      removeFromRoom(token);
      const room = newRoom();
      const p = addPlayer(room, token, cleanName(name), false, socketId);
      room.hostPub = p.pub;
      broadcast(room);
      return { ok: true, id: room.id };
    },

    solo(token, name, socketId) {
      removeFromRoom(token);
      const room = newRoom();
      const p = addPlayer(room, token, cleanName(name), false, socketId);
      room.hostPub = p.pub;
      beginMatch(room);
      return { ok: true, id: room.id };
    },

    joinRoom(token, name, id, socketId) {
      const code = String(id || '').trim().toUpperCase();
      const room = rooms[code];
      if (!room) return { error: 'Room not found. Check the 4-letter code.' };
      if (room.players[token]) {
        room.players[token].socketId = socketId;
        room.players[token].connected = true;
        broadcast(room);
        return { ok: true, id: room.id };
      }
      if (room.phase !== 'lobby') return { error: 'That match has already started.' };
      if (humans(room).length >= MAX_PLAYERS) return { error: 'Room is full.' };
      removeFromRoom(token);
      addPlayer(room, token, cleanName(name), false, socketId);
      broadcast(room);
      return { ok: true, id: room.id };
    },

    rejoin(token, socketId) {
      const room = roomOf(token);
      if (!room || !room.players[token]) return { error: 'No active room' };
      const p = room.players[token];
      p.socketId = socketId;
      p.connected = true;
      broadcast(room);
      return { ok: true, id: room.id };
    },

    startGame(token) {
      const room = roomOf(token);
      if (!room) return { error: 'You are not in a room.' };
      const me = room.players[token];
      if (me.pub !== room.hostPub) return { error: 'Only the host can start.' };
      if (room.phase !== 'lobby') return { error: 'Match already started.' };
      beginMatch(room);
      return { ok: true };
    },

    submitPick(token, data) {
      const room = roomOf(token);
      if (!room || room.phase !== 'pick') return { error: 'Not accepting picks right now.' };
      const me = room.players[token];
      if (me.pick) return { error: 'Already locked in.' };
      const move = String(data.move || '');
      const system = String(data.system || '');
      const valid = me.role === 'hacker' ? ATTACKS : DEFENSES;
      if (!Object.prototype.hasOwnProperty.call(valid, move)) return { error: 'Invalid move.' };
      if (!Object.prototype.hasOwnProperty.call(SYSTEMS, system)) return { error: 'Invalid system.' };
      me.pick = { move, system };
      if (allLocked(room)) endPick(room);
      else broadcast(room);
      return { ok: true };
    },

    submitChallenge(token, data) {
      const room = roomOf(token);
      if (!room || room.phase !== 'pick' || !room.challenge) return { error: 'No question right now.' };
      const me = room.players[token];
      if (me.challengeDone) return { error: 'Already answered.' };
      const index = Number(data.index);
      if (!Number.isInteger(index) || index < 0 || index >= room.challenge.options.length) {
        return { error: 'Invalid answer.' };
      }
      me.challengeDone = true;
      me.cTotal++;
      me.challengeOk = index === room.challenge.answer;
      if (me.challengeOk) { me.cOk++; me.score += 5; }
      send(me.socketId, 'state', viewFor(room, me));
      return { ok: true, correct: me.challengeOk };
    },

    playAgain(token) {
      const room = roomOf(token);
      if (!room) return { error: 'You are not in a room.' };
      const me = room.players[token];
      if (me.pub !== room.hostPub) return { error: 'Only the host can restart.' };
      if (room.phase !== 'end') return { error: 'Match is still running.' };
      Object.keys(room.players).forEach(k => {
        if (room.players[k].bot) delete room.players[k];
      });
      resetMatch(room);
      room.phase = 'lobby';
      broadcast(room);
      return { ok: true };
    },

    leave(token) {
      removeFromRoom(token);
      return { ok: true };
    },

    disconnect(token, socketId) {
      const room = roomOf(token);
      if (!room) return;
      const p = room.players[token];
      if (!p || p.socketId !== socketId) return; // a newer connection already took over
      p.connected = false;
      if (p.pub === room.hostPub) {
        const next = connectedHumans(room)[0];
        if (next) room.hostPub = next.pub;
      }
      if (room.phase === 'pick' && allLocked(room)) endPick(room);
      else broadcast(room);
    },

    sweep() {
      const now = Date.now();
      Object.values(rooms).forEach(room => {
        if (!connectedHumans(room).length && now - room.lastActive > IDLE_ROOM_MS) {
          clearTimeout(room.timer);
          humans(room).forEach(p => delete byToken[p.key]);
          delete rooms[room.id];
        }
      });
    }
  };
}

module.exports = { createEngine, META };
