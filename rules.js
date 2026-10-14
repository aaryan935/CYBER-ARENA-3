// Pure game rules. No networking in here, so it is easy to test and tweak.

const ATTACKS = {
  phishing:   { label: 'Phishing',           desc: 'Fake messages that trick people into handing over logins.', counter: 'training' },
  bruteforce: { label: 'Brute Force',        desc: 'Guesses passwords again and again until one works.',        counter: '2fa' },
  sqli:       { label: 'SQL Injection',      desc: 'Sneaks database commands into a form field.',               counter: 'validation' },
  ransomware: { label: 'Ransomware',         desc: 'Locks files and demands payment to unlock them.',           counter: 'backups' },
  social:     { label: 'Social Engineering', desc: 'Talks a person into breaking the rules.',                   counter: 'verification' }
};

const DEFENSES = {
  training:     { label: 'Staff Training',  desc: 'People learn to spot fake messages and risky links.' },
  '2fa':        { label: '2FA',             desc: 'A second proof of identity on top of the password.' },
  validation:   { label: 'Input Validation', desc: 'The app checks and cleans everything users type.' },
  backups:      { label: 'Backups',         desc: 'Tested copies let you restore without paying.' },
  verification: { label: 'ID Verification', desc: 'Confirm who is asking through a trusted channel.' }
};

const SYSTEMS = {
  email: 'Email Server',
  web:   'Web Login',
  db:    'Database',
  wifi:  'Wi-Fi Network'
};

// Which attacks realistically target which system ("threat intel").
// An attack on a poor-fit system only does minor damage.
const FIT = {
  email: ['phishing', 'social', 'ransomware'],
  web:   ['bruteforce', 'sqli'],
  db:    ['sqli', 'ransomware'],
  wifi:  ['bruteforce', 'social']
};

const COUNTER = {};
Object.keys(ATTACKS).forEach(k => { COUNTER[k] = ATTACKS[k].counter; });

const DAMAGE_FIT = 25;
const DAMAGE_OFF = 10;
const QUIZ_DAMAGE_BONUS = 10;
const REPAIR = 5;
const QUIZ_REPAIR_BONUS = 5;

const newSystems = () => ({ email: 100, web: 100, db: 100, wifi: 100 });

function freshStats() {
  const attacks = {};
  Object.keys(ATTACKS).forEach(k => { attacks[k] = { hit: 0, blocked: 0 }; });
  return { attacks };
}

function resolveRound(room, lessons) {
  const players = Object.values(room.players);
  const hackers = players.filter(p => p.role === 'hacker');
  const defenders = players.filter(p => p.role === 'defender');
  const results = [];

  for (const h of hackers) {
    if (!h.pick) {
      results.push({ attacker: h.name, skipped: true });
      continue;
    }
    const atk = h.pick.move;
    const sys = h.pick.system;
    const fit = FIT[sys].includes(atk);
    const blockers = defenders.filter(
      d => d.pick && d.pick.system === sys && d.pick.move === COUNTER[atk]
    );
    const blocked = blockers.length > 0;
    let damage = 0;

    if (blocked) {
      room.stats.attacks[atk].blocked++;
      blockers.forEach(b => {
        b.score += 10;
        room.systems[sys] = Math.min(100, room.systems[sys] + REPAIR + (b.challengeOk ? QUIZ_REPAIR_BONUS : 0));
      });
    } else {
      room.stats.attacks[atk].hit++;
      damage = (fit ? DAMAGE_FIT : DAMAGE_OFF) + (h.challengeOk ? QUIZ_DAMAGE_BONUS : 0);
      room.systems[sys] = Math.max(0, room.systems[sys] - damage);
      h.score += fit ? 10 : 5;
    }

    results.push({
      attacker: h.name,
      attack: atk,
      system: sys,
      fit,
      blocked,
      blockers: blockers.map(b => b.name),
      counter: COUNTER[atk],
      damage,
      lesson: blocked ? lessons[atk].blocked : lessons[atk].hit
    });
  }
  return results;
}

function checkWinner(systems, round, maxRounds) {
  const breached = Object.keys(systems).find(k => systems[k] <= 0);
  if (breached) return { winner: 'hackers', breached };
  if (round >= maxRounds) return { winner: 'defenders', breached: null };
  return null;
}

module.exports = {
  ATTACKS, DEFENSES, SYSTEMS, FIT, COUNTER,
  newSystems, freshStats, resolveRound, checkWinner
};
