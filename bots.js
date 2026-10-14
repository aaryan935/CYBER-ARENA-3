// Simple bots. They are beatable on purpose: mostly sensible, sometimes random.

const { ATTACKS, DEFENSES, SYSTEMS, FIT, COUNTER } = require('./rules');

const BOT_NAMES = ['Zero', 'Cipher', 'Nova', 'Rook', 'Echo', 'Vex', 'Ghost', 'Patch'];

const rnd = arr => arr[Math.floor(Math.random() * arr.length)];

function botName(taken) {
  const free = BOT_NAMES.filter(n => !taken.includes(n));
  return free.length ? rnd(free) : 'Bot' + Math.floor(Math.random() * 100);
}

function botPick(role, room) {
  const systems = Object.keys(SYSTEMS);

  if (role === 'hacker') {
    if (Math.random() < 0.75) {
      const system = rnd(systems);
      return { move: rnd(FIT[system]), system };
    }
    return { move: rnd(Object.keys(ATTACKS)), system: rnd(systems) };
  }

  // defender: lean towards the weakest system, usually pick a counter that fits
  const weakest = systems.slice().sort((a, b) => room.systems[a] - room.systems[b])[0];
  const system = Math.random() < 0.5 ? weakest : rnd(systems);
  if (Math.random() < 0.7) {
    return { move: COUNTER[rnd(FIT[system])], system };
  }
  return { move: rnd(Object.keys(DEFENSES)), system };
}

module.exports = { botName, botPick };
