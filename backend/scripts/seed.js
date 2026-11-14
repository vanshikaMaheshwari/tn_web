// Demo data for judging / local dev.  Usage: npm run seed  (add --reset to wipe first)
require('dotenv').config();
// Some ISPs/campus networks block the SRV lookups used by mongodb+srv:// URIs.
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Program = require('../models/Program');
const Resource = require('../models/Resource');
const Quiz = require('../models/Quiz');
const QuizSubmission = require('../models/QuizSubmission');
const Module = require('../models/Module');
const Event = require('../models/Event');
const Feedback = require('../models/Feedback');
const Query = require('../models/Query');
const Setting = require('../models/Setting');
const Reminder = require('../models/Reminder');
const CohortReport = require('../models/CohortReport');
const WorkflowRun = require('../models/WorkflowRun');
const Session = require('../models/Session');
const insights = require('../services/insights');

const DAY = 86400000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

async function seed({ reset = process.argv.includes('--reset') } = {}) {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URI);

  if (reset) {
    await Promise.all([Mentor, Mentee, Program, Resource, Quiz, QuizSubmission, Module, Event, Feedback, Query, Setting, Reminder, CohortReport, WorkflowRun, Session].map((M) => M.deleteMany({})));
    console.log('Collections cleared.');
  }
  if (await Program.exists({ name: 'Web Dev Cohort 2026' })) {
    console.log('Demo program already exists — run with --reset to recreate.');
    return;
  }

  const mentorPass = 'mentor123';
  const menteePass = 'mentee123';

  const web = await Program.create({ name: 'Web Dev Cohort 2026', description: 'HTML to full-stack in 10 weeks.' });
  const dsa = await Program.create({ name: 'DSA Bootcamp', description: 'Problem solving for placements.' });

  const mentor = await Mentor.create({
    name: 'Priya Gupta',
    email: 'mentor@techneeds.dev',
    password: await bcrypt.hash(mentorPass, 10),
    programs: [web._id],
    isAdmin: true, // core team: sees Command deck, Events and Inbox
  });
  await Mentor.create({ name: 'Meher Kapoor', email: 'meher@techneeds.dev', password: await bcrypt.hash(mentorPass, 10) });
  web.mentors.push(mentor._id);

  const R = (o) => Resource.create({ program: web._id, addedBy: mentor._id, ...o });
  const resources = [
    await R({ title: 'HTML & CSS foundations', type: 'video', url: 'https://www.youtube.com/watch?v=G3e-cpL7ofc', maxScore: 20, deadline: daysFromNow(-30), tags: ['html', 'css'] }),
    await R({ title: 'Flexbox and Grid layouts', type: 'video', url: 'https://www.youtube.com/watch?v=phWxA89Dy94', maxScore: 20, deadline: daysFromNow(-24), tags: ['css'] }),
    await R({ title: 'JavaScript closures in depth', type: 'video', url: 'https://www.youtube.com/watch?v=3a0I8ICR1Vg', maxScore: 20, deadline: daysFromNow(-18), tags: ['javascript'] }),
    await R({ title: 'Responsive landing page', type: 'project', maxScore: 200, deadline: daysFromNow(-12), description: 'Build and deploy a responsive landing page.', tags: ['css', 'ui_design'] }),
    await R({ title: 'React fundamentals', type: 'video', url: 'https://www.youtube.com/watch?v=SqcY0GlETPk', maxScore: 20, deadline: daysFromNow(-6), tags: ['react'] }),
    await R({ title: 'State management with Context API', type: 'video', url: 'https://www.youtube.com/watch?v=5LrDIWkK_Bc', maxScore: 20, deadline: daysFromNow(6), tags: ['react'] }),
    await R({ title: 'Build a portfolio with Next.js', type: 'project', maxScore: 300, deadline: daysFromNow(4), description: 'Ship a personal portfolio with Next.js and deploy it.', tags: ['react', 'nextjs'] }),
  ];

  const quizRes = await R({ title: 'React Hooks checkpoint', type: 'quiz', maxScore: 10, deadline: daysFromNow(2), tags: ['react'] });
  const quiz = await Quiz.create({
    resource: quizRes._id,
    startTime: daysFromNow(-1),
    endTime: daysFromNow(2),
    questions: [
      { questionText: 'Which hook runs side effects after render?', options: ['useMemo', 'useEffect', 'useRef', 'useId'], correctOptionIndex: 1, marks: 2 },
      { questionText: 'What does an empty dependency array mean for useEffect?', options: ['Runs every render', 'Never runs', 'Runs once after mount', 'Runs before mount'], correctOptionIndex: 2, marks: 2 },
      { questionText: 'Which hook keeps a mutable value without re-rendering?', options: ['useState', 'useRef', 'useReducer', 'useContext'], correctOptionIndex: 1, marks: 2 },
      { questionText: 'Custom hooks must start with…', options: ['get', 'use', 'hook', 'with'], correctOptionIndex: 1, marks: 2 },
      { questionText: 'useMemo is used to…', options: ['Memoize a computed value', 'Fetch data', 'Store DOM nodes', 'Create context'], correctOptionIndex: 0, marks: 2 },
    ],
  });
  quizRes.quiz = quiz._id;
  await quizRes.save();

  const futureQuiz = await R({ title: 'Async JavaScript checkpoint', type: 'quiz', maxScore: 6, deadline: daysFromNow(9), tags: ['javascript'] });
  const fq = await Quiz.create({
    resource: futureQuiz._id, startTime: daysFromNow(7), endTime: daysFromNow(9),
    questions: [
      { questionText: 'What does await pause?', options: ['The enclosing async function', 'The whole event loop'], correctOptionIndex: 0, marks: 2 },
      { questionText: 'Promise.all rejects when…', options: ['All reject', 'Any rejects'], correctOptionIndex: 1, marks: 2 },
      { questionText: 'setTimeout callbacks go to the…', options: ['Microtask queue', 'Task (macrotask) queue'], correctOptionIndex: 1, marks: 2 },
    ],
  });
  futureQuiz.quiz = fq._id;
  await futureQuiz.save();
  const weatherApp = await R({ title: 'Weather app with fetch()', type: 'project', maxScore: 100, deadline: daysFromNow(12), description: 'Call a public weather API with fetch(), handle loading and errors, and deploy it.', tags: ['javascript'] });

  // Modules → sub-topics → missions
  const mk = (title, description, order, subs) => Module.create({ program: web._id, title, description, order, subtopics: subs.map(([t, d, lock], k) => ({ title: t, description: d, order: k, lockUntilPrevious: !!lock })) });
  const m1 = await mk('Web foundations: HTML & CSS', 'Structure, style and layout: everything a web page is made of.', 0, [
    ['HTML & CSS basics', 'Tags, the box model and styling your first page.'],
    ['Layouts: Flexbox & Grid', 'Place anything anywhere, on any screen size.'],
    ['Ship a landing page', 'Put it together and deploy your first project.', true],
  ]);
  const m2 = await mk('JavaScript essentials', 'Make pages interactive and talk to APIs.', 1, [
    ['Scope & closures', 'How JavaScript remembers variables.'],
    ['Async JavaScript', 'Callbacks → promises → async/await.', true],
    ['Fetch & APIs', 'Get real data from the internet.', true],
  ]);
  const m3 = await mk('React & building real apps', 'Components, state and shipping a real portfolio.', 2, [
    ['React fundamentals', 'Components, props and hooks.'],
    ['State with Context', 'Share state without prop drilling.'],
    ['Portfolio project', 'Your own site, built with Next.js.'],
  ]);
  // Curated reference videos (all checked to exist on YouTube). Watch-along material, no points.
  const yt = (id, title, channel, minutes) => ({ title, url: `https://www.youtube.com/watch?v=${id}`, channel, minutes, addedBy: 'TechNeeds mentors' });
  const REFS = [
    [m1, 0, [yt('qz0aGYrrlhU', 'HTML Tutorial for Beginners: HTML Crash Course', 'Programming with Mosh', 60), yt('UB1O30fR-EE', 'HTML Crash Course For Absolute Beginners', 'Traversy Media', 60), yt('yfoY53QXEnI', 'CSS Crash Course For Absolute Beginners', 'Traversy Media', 85)]],
    [m1, 1, [yt('fYq5PXgSsbE', 'Learn Flexbox in 15 Minutes', 'Web Dev Simplified', 15), yt('u044iM9xsWU', 'Learn flexbox the easy way', 'Kevin Powell'), yt('3YW65K6LcIA', 'Flexbox Crash Course', 'Traversy Media'), yt('jV8B24rSN5o', 'CSS Grid Layout Crash Course', 'Traversy Media')]],
    [m1, 2, [yt('2KL-z9A56SQ', 'Learn how to use CSS Media Queries in less than 5 minutes', 'Kevin Powell', 5), yt('bn-DQCifeQQ', 'Responsive design made easy', 'Kevin Powell'), yt('AD-3nVI3-_U', 'How to Deploy a Static Website to GitHub Pages', '')]],
    [m2, 0, [yt('3a0I8ICR1Vg', 'Learn Closures In 7 Minutes', 'Web Dev Simplified', 7), yt('47SPG8TvUXA', 'Learn Closures In 13 Minutes (with interview questions)', 'Web Dev Simplified', 13)]],
    [m2, 1, [yt('RvYYCGs45L4', 'JavaScript Promise in 100 Seconds', 'Fireship', 2), yt('DHvZLI7Db8E', 'JavaScript Promises In 10 Minutes', 'Web Dev Simplified', 10), yt('vn3tm0quoqE', 'The Async Await Episode I Promised', 'Fireship')]],
    [m2, 2, [yt('cuEtnrL9-H0', 'Learn Fetch API In 6 Minutes', 'Web Dev Simplified', 6)]],
    [m3, 0, [yt('Tn6-PIqc4UM', 'React in 100 Seconds', 'Fireship', 2), yt('O6P86uwfdR0', 'Learn useState In 15 Minutes', 'Web Dev Simplified', 15)]],
    [m3, 1, [yt('ngVvDegsAW8', 'State Management in React (Context API + useContext)', 'Dave Gray', 25), yt('kK_Wqx3RnHk', 'Learn useReducer In 20 Minutes', 'Web Dev Simplified', 20)]],
    [m3, 2, [yt('Sklc_fQBmcs', 'Next.js in 100 Seconds + Full Beginner’s Tutorial', 'Fireship')]],
  ];
  for (const [mod, k, refs] of REFS) mod.subtopics[k].references = refs;
  await Promise.all([m1.save(), m2.save(), m3.save()]);

  const place = async (res, mod, k) => { res.module = mod._id; res.subtopic = mod.subtopics[k]._id; await res.save(); };
  await place(resources[0], m1, 0); await place(resources[1], m1, 1); await place(resources[3], m1, 2);
  await place(resources[2], m2, 0); await place(futureQuiz, m2, 1); await place(weatherApp, m2, 2);
  await place(resources[4], m3, 0); await place(quizRes, m3, 0); await place(resources[5], m3, 1); await place(resources[6], m3, 2);

  web.resources = [...resources, quizRes, futureQuiz, weatherApp].map((r) => r._id);
  await web.save();
  await dsa.save();

  const people = [
    ['Riya Malhotra', ['react', 'open_source'], [1, 1, 1, 0.9, 1, 1], 14],
    ['Kavya Nair', ['ui_design', 'react'], [1, 1, 1, 0.85, 1], 9, 'pendingPortfolio'],
    ['Ishita Rao', ['javascript', 'dsa'], [1, 1, 1, 0.8, 1], 6],
    ['Ananya Sharma', ['react', 'ui_design', 'open_source'], [1, 1, 1, 0.7, 1], 12],
    ['Sneha Verma', ['ml', 'python'], [1, 1, 1, 0.6], 3],
    ['Tanvi Joshi', ['web3'], [1, 1, 0, 0.5], 1],
    ['Aditi Singh', ['android'], [1, 1], 0],
    ['Mehak Arora', ['cloud'], [1], 0],
  ];

  const hash = await bcrypt.hash(menteePass, 10);
  let i = 0;
  for (const [name, interests, completion, streak, extra] of people) {
    i += 1;
    const completedResources = [];
    completion.forEach((frac, idx) => {
      const r = resources[idx];
      if (!frac) return;
      const when = new Date(r.deadline.getTime() - (1 + (i % 3)) * DAY);
      if (name.startsWith('Ananya')) when.setUTCHours(17, 15); // ~10:45 pm IST: the 'night owl' demo
      completedResources.push({
        resource: r._id,
        score: Math.round(r.maxScore * frac),
        completedOn: when,
        submittedOn: r.type === 'project' ? when : undefined,
        verified: true,
        githubLink: r.type === 'project' ? `https://github.com/demo/${name.split(' ')[0].toLowerCase()}-landing` : undefined,
        deployedLink: r.type === 'project' ? `https://${name.split(' ')[0].toLowerCase()}-landing.vercel.app` : undefined,
        description: r.type === 'project' ? 'Responsive landing page built with semantic HTML, CSS grid and a mobile-first approach.' : undefined,
      });
    });
    if (extra === 'pendingPortfolio') {
      completedResources.push({
        resource: resources[6]._id, score: 0, verified: false, submittedOn: daysFromNow(-0.2), completedOn: daysFromNow(-0.2),
        githubLink: 'https://github.com/demo/kavya-portfolio', deployedLink: 'https://kavya-portfolio.vercel.app',
        description: 'Personal portfolio built with Next.js App Router, MDX blog posts and a dark mode toggle. Deployed on Vercel.',
      });
    }
    await Mentee.create({
      name,
      email: `${name.split(' ')[0].toLowerCase()}@igdtuw.ac.in`,
      enrollmentNumber: `TN-WEBD-${String(i).padStart(4, '0')}`,
      password: hash,
      programs: [web._id],
      interests,
      streak,
      lastActiveDate: streak ? new Date() : daysFromNow(-5),
      completedResources,
      createdBy: mentor._id,
      ...(name.startsWith('Ananya') && {
        privacy: { publicProfile: true, showRank: true, recruiterVisible: false },
        endorsement: { text: 'Strongest React work in the cohort. Ship that portfolio and I’ll review it first!', mentor: mentor._id, mentorName: mentor.name, at: new Date() },
      }),
    });
  }

  // Events (photos live in frontend/public/events). Edit or add more from Mission Control → Events.
  const E = (o) => Event.create({ published: true, createdBy: mentor._id, ...o });
  await E({ title: 'InnoVortex 4.0', type: 'hackathon', featured: true, tracks: ['PitchStorm', 'Reimagathon', 'Hackathon'],
    description: 'TechNeeds’ flagship innovation fest. Pitch a startup idea, reimagine a real platform, or build in the hackathon.',
    startsAt: new Date('2026-11-05T04:30:00Z'), endsAt: new Date('2026-11-30T12:30:00Z'), mode: 'hybrid', venue: 'Online rounds + offline finale at IGDTUW',
    registerUrl: 'https://www.communityx.in/', imageUrl: '/events/iv4-banner.jpg', color: '#BFE9FF' });
  await E({ title: '21 Days of CS FUNdamentals', type: 'bootcamp', description: 'OOPs, DBMS, OS and CN prep for intern and placement season. Participation certificates for all; resume reviews for the top 30 performers.',
    startsAt: new Date('2027-01-01T04:30:00Z'), endsAt: new Date('2027-01-21T12:30:00Z'), dateLabel: '1 Jan onwards', mode: 'online', venue: 'Online', imageUrl: '/events/cs21.jpg', color: '#BFE9FF' });
  await E({ title: 'InnoVortex 3.0', type: 'hackathon', tracks: ['Ideathon', 'Reimagine', 'Hackathon'], description: 'Two days of ideation, reimagination and hacking at IIIT Delhi.',
    startsAt: new Date('2025-10-04T04:30:00Z'), endsAt: new Date('2025-10-05T12:30:00Z'), mode: 'offline', venue: 'IIIT Delhi',
    imageUrl: '/events/iv3-poster.jpg', gallery: ['/events/iv3-wrap.jpg', '/events/iv3-tracks.jpg', '/events/iv3-starburst.jpg', '/events/iv-stats.jpg'],
    highlight: '2 lakh+ impressions · 3500+ registrations · 500+ submissions · top 80 teams', color: '#FFE45C' });
  await E({ title: 'Summer Skills Sprint Challenge 2026', type: 'challenge', description: 'Step into the multiverse of creativity and tech.',
    startsAt: new Date('2026-06-01T04:30:00Z'), endsAt: new Date('2026-06-30T12:30:00Z'), dateLabel: 'Summer 2026', mode: 'online', imageUrl: '/events/summer-sprint.jpg', color: '#FFD1DC' });
  await E({ title: 'Orientation ’25', type: 'orientation', description: 'Welcoming the new batch to TechNeeds.',
    startsAt: new Date('2025-08-20T05:30:00Z'), dateLabel: '2025', mode: 'offline', venue: 'IGDTUW auditorium', imageUrl: '/events/orientation25.jpg', color: '#E6DEFF' });
  await E({ title: 'Shark Tank IGDTUW', type: 'pitch', description: 'Students pitched startup ideas to a panel of judges.',
    startsAt: new Date('2025-03-01T05:30:00Z'), dateLabel: 'Past event', mode: 'offline', venue: 'IGDTUW', imageUrl: '/events/shark-tank.jpg', color: '#C9F5DF' });
  await E({ title: 'Global Trade & Protectionism', type: 'talk', description: 'Expert talk with certificates and goodies for participants.',
    startsAt: new Date('2025-02-01T05:30:00Z'), dateLabel: 'Past event', mode: 'offline', venue: 'IGDTUW', imageUrl: '/events/trade-seminar.jpg', color: '#BFE9FF' });
  const iv2 = await E({ title: 'InnoVortex 2.0', type: 'hackathon', description: 'The second InnoVortex, and the team celebration after it.',
    startsAt: new Date('2024-10-01T05:30:00Z'), dateLabel: 'Past event', mode: 'offline', imageUrl: '/events/iv2-cake.jpg', gallery: ['/events/iv2-celebration.jpg'], color: '#FFE45C' });

  await Setting.create({ key: 'announcement', value: { text: 'InnoVortex 4.0 Round 1 is live. Results on the Events page soon!', by: mentor.name, at: new Date() } });
  await Query.create([
    { ticket: 'TN-Q-0001', name: 'Isha', email: 'isha@igdtuw.ac.in', topic: 'joining', message: 'Can I join the DSA bootcamp if I’m in ECE? Do I need to know C++ already?' },
    { ticket: 'TN-Q-0002', name: 'Meher', email: 'meher.s@igdtuw.ac.in', topic: 'events', message: 'Will InnoVortex 4.0 give certificates for Round 1?' },
    { ticket: 'TN-Q-0003', name: 'Sana', email: 'sana@igdtuw.ac.in', topic: 'missions', message: 'The quiz closed before I could submit. Can it reopen?', status: 'answered', reply: 'Quizzes close at the deadline so everyone gets the same window, but your mentor can extend it once. Message them from the Launchpad.', repliedBy: mentor.name, repliedAt: new Date() },
  ]);
  await Feedback.create([
    { source: 'event', event: iv2._id, rating: 5, comment: 'Loved the vibe and the mentors. More snacks next time!', name: 'Ritika' },
    { source: 'mission', resource: resources[4]._id, rating: 4, comment: 'Great React intro, a bit fast in the middle.' },
    { source: 'site', rating: 5, comment: 'The new Launchpad finally makes sense.', page: '/dashboard' },
  ]);

  // Live classes (Google Meet) + recorded lectures. Demo Meet codes: replace with your real links.
  const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; };
  const S = (o) => Session.create({ program: web._id, host: mentor.name, createdBy: mentor._id, durationMin: 60, ...o });
  await S({ title: 'Doubt clinic: closures & scope', agenda: 'Bring the closure questions you got stuck on. We’ll live-code 3 interview problems.', startsAt: at(1, 19), meetUrl: 'https://meet.google.com/tnw-clos-ure', module: m2._id, subtopic: m2.subtopics[0]._id });
  await S({ title: 'Live build: weather app with fetch()', agenda: 'Build the weather-app mission together: fetch, loading states, errors, deploy.', startsAt: at(3, 18, 30), durationMin: 90, meetUrl: 'https://meet.google.com/tnw-fetc-hapi', module: m2._id, subtopic: m2.subtopics[2]._id });
  await S({ title: 'React kickoff + portfolio Q&A', agenda: 'Components, props and how the Next.js portfolio project is graded.', startsAt: at(8, 19), meetUrl: 'https://meet.google.com/tnw-reac-tkof', module: m3._id, subtopic: m3.subtopics[0]._id });
  await S({ title: 'Flexbox & Grid walkthrough', agenda: 'Layouts from scratch.', startsAt: at(-20, 19), meetUrl: 'https://meet.google.com/tnw-flex-grid', module: m1._id, subtopic: m1.subtopics[1]._id,
    recordingUrl: 'https://www.youtube.com/watch?v=fYq5PXgSsbE', recordingNotes: 'Demo data: a public tutorial stands in for the class recording. Mentors paste their own Meet recording (Drive) or YouTube link here.' });
  await S({ title: 'Async JavaScript explained', agenda: 'Callbacks → promises → async/await.', startsAt: at(-5, 19), meetUrl: 'https://meet.google.com/tnw-asyn-cjsx', module: m2._id, subtopic: m2.subtopics[1]._id,
    recordingUrl: 'https://www.youtube.com/watch?v=vn3tm0quoqE', recordingNotes: 'Demo data: a public tutorial stands in for the class recording.' });
  await S({ title: 'Orientation: how TechNeeds works', agenda: 'Missions, points, streaks and the AI card.', startsAt: at(-32, 18), meetUrl: 'https://meet.google.com/tnw-orie-ntat' });

  // First reminders + weekly reports, so the Launchpad and Mission control aren't empty.
  // (Same code the Render Workflow tasks run; rules summaries only, no Gemini call here.)
  const digest = await insights.runDeadlineDigest({ hours: 48 });
  for (const id of await insights.programIds()) await insights.buildCohortReport(id);
  console.log(`Automations: ${digest.withReminders} mentees with reminders, weekly reports for every cohort.`);

  console.log('\nDemo data ready');
  console.log('  Mentor (core team): mentor@techneeds.dev /', mentorPass, '  — sees Command deck, Events, Inbox, Automations');
  console.log('  Mentor (regular)  : meher@techneeds.dev /', mentorPass);
  console.log('  Mentee  : TN-WEBD-0004 (Ananya) /', menteePass, '  — any TN-WEBD-0001…0008 works');
  console.log('  Public AI card: /u/TN-WEBD-0004\n');
}

if (require.main === module) {
  seed().then(() => mongoose.disconnect()).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = seed;
