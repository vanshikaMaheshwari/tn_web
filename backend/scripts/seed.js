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

const DAY = 86400000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

async function seed({ reset = process.argv.includes('--reset') } = {}) {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URI);

  if (reset) {
    await Promise.all([Mentor, Mentee, Program, Resource, Quiz, QuizSubmission].map((M) => M.deleteMany({})));
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

  web.resources = [...resources, quizRes, futureQuiz].map((r) => r._id);
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

  console.log('\nDemo data ready');
  console.log('  Admin   :', process.env.ADMIN_EMAIL, '/ (ADMIN_PASSWORD from .env)');
  console.log('  Mentor  : mentor@techneeds.dev /', mentorPass);
  console.log('  Mentee  : TN-WEBD-0004 (Ananya) /', menteePass, '  — any TN-WEBD-0001…0008 works');
  console.log('  Public AI card: /u/TN-WEBD-0004\n');
}

if (require.main === module) {
  seed().then(() => mongoose.disconnect()).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = seed;
