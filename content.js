// All educational text lives here. Edit freely: add more lessons and questions.

const LESSONS = {
  phishing: {
    hit: 'Phishing works when people click first and check later. One stolen login can open a whole mailbox.',
    blocked: 'Trained staff check the sender and the link before clicking, which defeats most phishing.'
  },
  bruteforce: {
    hit: 'Without a second factor, a guessed or leaked password is enough to get in.',
    blocked: '2FA means a stolen or guessed password alone is not enough to log in.'
  },
  sqli: {
    hit: 'If a site pastes user input straight into a database query, an attacker can rewrite that query.',
    blocked: 'Validating input and using parameterized queries keeps user text as data, never as commands.'
  },
  ransomware: {
    hit: 'Without clean backups, attackers hold the only copy of your files and the leverage that comes with it.',
    blocked: 'Offline, tested backups let you restore your files and refuse to pay.'
  },
  social: {
    hit: 'A confident voice and a believable story can beat good technology. Attackers target people, not just computers.',
    blocked: 'Hanging up and calling back on a known number stops most impersonation attempts.'
  }
};

const OFF_TARGET_NOTE = 'That attack is a poor match for this system, so it only did minor damage.';

// answer = index of the correct option. Options are shuffled by the server each round.
const CHALLENGES = [
  {
    q: 'Which email is most likely phishing?',
    options: [
      'An invoice from a vendor you know, sent from their usual address',
      'URGENT: verify your account within 10 minutes at paypa1-secure.com',
      'A team lunch invite from a coworker',
      'A calendar invite from your manager for tomorrow'
    ],
    answer: 1,
    why: 'Pressure to act fast plus a look-alike web address ("paypa1") are classic phishing signs.'
  },
  {
    q: 'Which password is the strongest?',
    options: ['Summer2024!', 'P@ssw0rd', 'correct-horse-battery-staple-92', 'qwerty123'],
    answer: 2,
    why: 'Length wins. A long passphrase is much harder to guess than a short password with swapped symbols.'
  },
  {
    q: 'What does two-factor authentication (2FA) add?',
    options: [
      'A second proof of identity beyond your password',
      'A faster internet connection',
      'Encryption of your whole hard drive',
      'Protection from every kind of malware'
    ],
    answer: 0,
    why: '2FA asks for something you have (like a phone code) in addition to something you know.'
  },
  {
    q: 'A caller says they are from IT and asks for the code just sent to your phone. What should you do?',
    options: [
      'Read it out quickly so they can fix the problem',
      'Hang up and call IT back on the official number',
      'Ask them to send an email instead',
      'Give them only half of the code'
    ],
    answer: 1,
    why: 'Real IT teams never need your one-time code. Verify through a number you already trust.'
  },
  {
    q: 'What is the best protection against losing files to ransomware?',
    options: [
      'Pay quickly so the attackers go away',
      'Keep offline backups and test restoring them',
      'Rename all your important files',
      'Turn off your monitor'
    ],
    answer: 1,
    why: 'Backups you can actually restore remove the attackers\' leverage.'
  },
  {
    q: 'A padlock icon (HTTPS) in the browser means what?',
    options: [
      'The website is guaranteed to be honest',
      'Your connection is encrypted, but the site could still be fake',
      'The site has no viruses',
      'The government has verified the owner'
    ],
    answer: 1,
    why: 'HTTPS protects data in transit. Scam sites can use it too, so always check the address.'
  },
  {
    q: 'SQL injection happens when...',
    options: [
      'An app puts user input directly into a database query',
      'Wi-Fi is left open',
      'Passwords are too short',
      'Staff click a link in an email'
    ],
    answer: 0,
    why: 'Unchecked input can change the meaning of a query. Parameterized queries fix this.'
  },
  {
    q: 'What is the safest habit on public Wi-Fi?',
    options: [
      'Log into your bank, it is fine',
      'Avoid sensitive logins, or use a trusted VPN',
      'Share the Wi-Fi password with everyone',
      'Turn off all software updates'
    ],
    answer: 1,
    why: 'Public networks are shared with strangers. Keep sensitive activity off them or protect the connection.'
  },
  {
    q: 'Why should you install software updates?',
    options: [
      'They add new emojis',
      'They fix known security holes',
      'They use more memory',
      'They reset your passwords'
    ],
    answer: 1,
    why: 'Many attacks use holes that already have a published fix. Updating closes them.'
  },
  {
    q: 'You find a USB stick in the car park. What do you do?',
    options: [
      'Plug it into your work computer to see who owns it',
      'Hand it to IT or security without plugging it in',
      'Format it and use it',
      'Take it home and try it there'
    ],
    answer: 1,
    why: 'Dropped USB sticks are a known way to deliver malware. Let IT handle it.'
  }
];

module.exports = { LESSONS, OFF_TARGET_NOTE, CHALLENGES };
