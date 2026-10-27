export const LEARNING_STREAMS = ['Software Development', 'IT Support', 'Web Development']
export const LEARNING_COHORTS = ['Demand 1', 'Data', 'Computer Centre', 'Marketing', 'Clickatell']
const STORAGE_PREFIX = 'capaciti-learning-demo-v4'

const PATHS = {
  'Software Development': [
    'Introduction to Software Development', 'Git and GitHub', 'Programming Fundamentals',
    'Python Programming', 'JavaScript Fundamentals', 'Databases and SQL',
    'APIs and Backend Development', 'Web Development', 'React Fundamentals',
    'Node.js and Express', 'Django', 'Cloud Computing', 'Docker and Containers',
    'AI-Assisted Software Development', 'Generative AI: Elevate Your Software Development Career',
  ],
  'IT Support': [
    'Introduction to IT Support', 'Computer Hardware Essentials', 'Operating Systems',
    'Troubleshooting Fundamentals', 'Networking Basics', 'IP Addressing and DNS',
    'Windows Support', 'Linux Essentials', 'Service Desk Practices',
    'Cybersecurity Fundamentals', 'Cloud Support', 'Identity and Access Management',
    'Monitoring and Diagnostics', 'IT Automation Basics', 'Professional IT Support Capstone',
  ],
  'Web Development': [
    'Introduction to Web Development', 'HTML Foundations', 'CSS Foundations',
    'Responsive Web Design', 'JavaScript Fundamentals', 'Browser APIs',
    'Accessible Web Interfaces', 'Git and GitHub', 'React Fundamentals',
    'State and Component Design', 'Working with APIs', 'Web Performance',
    'Testing Web Applications', 'Deploying Web Applications', 'Web Development Capstone',
  ],
  Data: [
    'Introduction to Data', 'Data Literacy', 'Spreadsheets for Analysis', 'SQL Fundamentals',
    'Data Cleaning', 'Data Visualisation', 'Statistics Essentials', 'Python for Data',
    'Working with Datasets', 'Business Intelligence', 'Dashboard Design', 'Data Storytelling',
    'Responsible Data Practice', 'Analytics Project', 'Data Career Capstone',
  ],
  'Computer Centre': [
    'Digital Skills Foundations', 'Computer Hardware', 'Operating Systems', 'File Management',
    'Productivity Tools', 'Internet Essentials', 'Digital Communication', 'Cyber Safety',
    'Customer Support', 'Device Troubleshooting', 'Printing and Peripherals', 'Cloud Storage',
    'Digital Accessibility', 'IT Service Practice', 'Computer Centre Capstone',
  ],
  Marketing: [
    'Marketing Foundations', 'Audience Research', 'Brand Strategy', 'Content Planning',
    'Social Media Marketing', 'Email Campaigns', 'Search Marketing', 'Marketing Analytics',
    'Creative Briefs', 'Campaign Measurement', 'Customer Journeys', 'Digital Advertising',
    'Marketing Automation', 'Portfolio Development', 'Marketing Capstone',
  ],
  Clickatell: [
    'Customer Experience Foundations', 'Business Messaging', 'Conversation Design', 'Customer Journeys',
    'Messaging Channels', 'Support Operations', 'Service Analytics', 'Product Fundamentals',
    'Digital Customer Care', 'Workflow Design', 'Data Privacy Essentials', 'Quality Assurance',
    'Team Collaboration', 'Customer Success Practice', 'Messaging Capstone',
  ],
}

const PEOPLE = [
  ['Lisolethu Mgatyelwa', 'Demand 1', 'Software Development', 10, 5],
  ['Buhle Mbeki', 'Demand 1', 'Software Development', 7, 0],
  ['Aviwe Mgatyelwa', 'Demand 1', 'Software Development', 12, 0],
  ['Lukhanyo Ntshinga', 'Demand 1', 'Software Development', 4, 25],
  ['Asanda Mokoena', 'Demand 1', 'Software Development', 9, 0],
  ['Amahle Jacobs', 'Demand 1', 'Software Development', 6, 45],
  ['Siyabonga Ndlovu', 'Demand 1', 'Software Development', 0, 0],
  ['Zintle Maseko', 'Demand 1', 'Software Development', 13, 0],
  ['Yandisa Qwabe', 'Demand 1', 'Software Development', 2, 70],
  ['Nandi Dlamini', 'Demand 1', 'Web Development', 8, 0],
  ['Thando Cele', 'Demand 1', 'Web Development', 5, 30],
  ['Nomsa Mkhize', 'Demand 1', 'Web Development', 11, 0],
  ['Lerato Molefe', 'Demand 1', 'Web Development', 3, 0],
  ['Khanyisa Gqeba', 'Demand 1', 'Web Development', 15, 0],
  ['Mthobisi Nene', 'Demand 1', 'Web Development', 0, 0],
  ['Nosipho Dube', 'Demand 1', 'Web Development', 7, 55],
  ['Kamohelo Masuku', 'Demand 1', 'Web Development', 2, 20],
  ['Lwazi Sithole', 'Demand 1', 'Web Development', 10, 0],
  ['Sibusiso Khumalo', 'Demand 1', 'IT Support', 12, 0],
  ['Nandi Mbeki', 'Demand 1', 'IT Support', 7, 40],
  ['Olwethu Daniels', 'Demand 1', 'IT Support', 4, 0],
  ['Anathi Mokoena', 'Demand 1', 'IT Support', 9, 15],
  ['Palesa Moagi', 'Demand 1', 'IT Support', 15, 0],
  ['Vuyani Hadebe', 'Demand 1', 'IT Support', 0, 0],
  ['Noxolo Mthembu', 'Demand 1', 'IT Support', 6, 65],
  ['Sanele Gumede', 'Demand 1', 'IT Support', 3, 0],
  ['Lihle Nkomo', 'Demand 1', 'IT Support', 10, 25],
  ['Zanele Maseko', 'Data', null, 10, 0],
  ['Thabiso Khumalo', 'Data', null, 6, 20],
  ['Noluthando Nene', 'Data', null, 3, 50],
  ['Vusi Dlamini', 'Data', null, 12, 0],
  ['Babalwa Mokoena', 'Data', null, 8, 35],
  ['Mandla Zulu', 'Data', null, 0, 0],
  ['Lindiwe Jacobs', 'Data', null, 14, 0],
  ['Aphiwe Mthembu', 'Data', null, 5, 65],
  ['Kuhle Nkosi', 'Data', null, 9, 0],
  ['Sizwe Cele', 'Computer Centre', null, 7, 0],
  ['Thembeka Mbeki', 'Computer Centre', null, 4, 30],
  ['Musa Ndlovu', 'Computer Centre', null, 11, 0],
  ['Lulama Dube', 'Computer Centre', null, 2, 0],
  ['Andile Mkhize', 'Computer Centre', null, 15, 0],
  ['Zimkhitha Maseko', 'Computer Centre', null, 0, 0],
  ['Mihlali Jacobs', 'Computer Centre', null, 6, 55],
  ['Siyanda Nene', 'Computer Centre', null, 3, 20],
  ['Lwazi Mokoena', 'Computer Centre', null, 10, 0],
  ['Ayabonga Zulu', 'Marketing', null, 9, 0],
  ['Zimasa Dlamini', 'Marketing', null, 5, 25],
  ['Lutho Mbeki', 'Marketing', null, 12, 0],
  ['Noxolo Ndlovu', 'Marketing', null, 4, 0],
  ['Siyabonga Cele', 'Marketing', null, 15, 0],
  ['Anele Jacobs', 'Marketing', null, 0, 0],
  ['Lethabo Mkhize', 'Marketing', null, 7, 45],
  ['Asanda Nkosi', 'Marketing', null, 2, 35],
  ['Buhle Sithole', 'Marketing', null, 10, 0],
  ['Mihlali Mokoena', 'Clickatell', null, 8, 0],
  ['Lwandle Khumalo', 'Clickatell', null, 6, 25],
  ['Aphiwe Dlamini', 'Clickatell', null, 13, 0],
  ['Nolwazi Maseko', 'Clickatell', null, 3, 0],
  ['Bongani Mthembu', 'Clickatell', null, 15, 0],
  ['Nandipha Jacobs', 'Clickatell', null, 0, 0],
  ['Sanele Ndlovu', 'Clickatell', null, 9, 40],
  ['Lihle Cele', 'Clickatell', null, 4, 15],
  ['Mzi Mkhize', 'Clickatell', null, 11, 0],
]

const STREAM_SKILLS = {
  'Software Development': ['Python', 'JavaScript', 'Problem solving', 'Git', 'Web development'],
  'IT Support': ['Troubleshooting', 'Networking', 'Operating systems', 'Customer support', 'Cloud fundamentals'],
  'Web Development': ['HTML', 'CSS', 'JavaScript', 'Accessibility', 'Responsive design'],
  Data: ['Data analysis', 'SQL', 'Spreadsheets', 'Data visualisation', 'Statistics'],
  'Computer Centre': ['Digital literacy', 'Productivity tools', 'Troubleshooting', 'Online safety', 'Customer support'],
  Marketing: ['Content strategy', 'Audience research', 'Campaigns', 'Analytics', 'Brand development'],
  Clickatell: ['Customer experience', 'Business messaging', 'Conversation design', 'Support operations', 'Service analytics'],
}

function makeCourse(title, index, completeCount, currentProgress, seed) {
  const current = index === completeCount && currentProgress > 0 && completeCount < 15
  const completed = index < completeCount
  const percent = completed ? 100 : current ? currentProgress : 0
  const upcomingIndex = completeCount + (current ? 1 : 0)
  const completedModules = Math.floor((percent / 100) * 3)
  const status = completed ? 'Completed' : current ? 'In Progress' : index === upcomingIndex ? 'Upcoming' : 'Locked'
  const moduleNames = ['Learn the concepts', 'Guided practice', 'Knowledge check']
  return {
    id: `course-${index + 1}`,
    title,
    category: title.includes('AI') || title.includes('Generative') ? 'Generative AI' : title.split(' ')[0],
    description: `Build practical skills in ${title.toLowerCase()} through short lessons and applied exercises.`,
    progress: percent,
    status,
    modules: moduleNames.map((name, moduleIndex) => ({
      title: `${title}: ${name}`,
      status: status === 'Locked' ? 'Locked' : moduleIndex < completedModules
        ? 'Completed'
        : current && moduleIndex === completedModules ? 'In Progress' : 'Upcoming',
    })),
    quiz: { completed: completed || (current && currentProgress >= 50), score: completed ? 75 + (seed % 26) : current && currentProgress >= 50 ? 50 + (seed % 36) : null },
    duration: `${2 + ((seed + index) % 5)} hours`,
    lastActivity: percent > 0 ? new Date(Date.UTC(2026, 9, 25 - ((seed + index) % 8), 10)).toISOString() : null,
    feedback: '',
  }
}

export function createCandidateLearningRecord({ id, name, cohort = 'Demand 1', stream, completedCount, currentProgress = 0, seed = 1 }) {
  const pathKey = stream || cohort
  const courses = PATHS[pathKey].map((title, index) => makeCourse(title, index, completedCount, currentProgress, seed))
  return {
    id,
    name,
    cohort,
    stream,
    courses,
    skills: STREAM_SKILLS[pathKey],
    savedCourseIds: courses.filter((course) => course.status === 'Upcoming').slice(0, 2).map((course) => course.id),
  }
}

export function createDemoCandidates() {
  return PEOPLE.map(([name, cohort, stream, completedCount, currentProgress], index) => createCandidateLearningRecord({
    id: `DEMO-${String(index + 1).padStart(3, '0')}`,
    name,
    cohort,
    stream,
    completedCount,
    currentProgress,
    seed: index + 7,
  }))
}

export function courseProgress(course) {
  return course.progress
}

export function candidateProgress(candidate) {
  return Math.round(candidate.courses.reduce((sum, course) => sum + course.progress, 0) / candidate.courses.length)
}

export function courseStatus(course) {
  return course.status
}

export function candidateStatus(candidate) {
  if (candidate.courses.every((course) => course.status === 'Completed')) return 'Completed'
  return candidate.courses.some((course) => course.progress > 0) ? 'In Progress' : 'Not Started'
}

export function completedCourseCount(candidate) {
  return candidate.courses.filter((course) => course.status === 'Completed').length
}

export function currentCourse(candidate) {
  return candidate.courses.find((course) => course.status === 'In Progress')
    ?? candidate.courses.find((course) => course.status === 'Upcoming')
}

export function latestActivity(candidate) {
  return candidate.courses.reduce((latest, course) => (
    course.lastActivity && (!latest || course.lastActivity > latest) ? course.lastActivity : latest
  ), null)
}

export function storageKeyForCandidate(candidateId) {
  return `${STORAGE_PREFIX}:${candidateId}`
}

export function readCandidateRecord(candidateId, fallback) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeyForCandidate(candidateId)))
    if (stored?.id === candidateId && Array.isArray(stored.courses) && stored.courses.length === 15) return stored
  } catch {
    // Use the in-memory demo record if local storage is unavailable or invalid.
  }
  return fallback
}

export function writeCandidateRecord(candidate) {
  try {
    localStorage.setItem(storageKeyForCandidate(candidate.id), JSON.stringify(candidate))
  } catch {
    // In-memory changes remain available while the page is open.
  }
}

export function readDemoCandidates() {
  return createDemoCandidates().map((candidate) => readCandidateRecord(candidate.id, candidate))
}

export function updateCourseProgress(candidate, courseId, progress) {
  const clampedProgress = Math.max(0, Math.min(100, Number(progress)))
  const target = candidate.courses.find((course) => course.id === courseId)
  if (!target) return candidate
  const index = candidate.courses.indexOf(target)
  const nextCourses = candidate.courses.map((course, courseIndex) => {
    if (courseIndex < index) return { ...course, progress: 100, status: 'Completed' }
    if (courseIndex === index) return {
      ...course,
      progress: clampedProgress,
      status: clampedProgress === 100 ? 'Completed' : clampedProgress > 0 ? 'In Progress' : 'Upcoming',
      modules: course.modules.map((module, moduleIndex) => ({
        ...module,
        status: moduleIndex < Math.floor((clampedProgress / 100) * course.modules.length)
          ? 'Completed'
          : clampedProgress > 0 && moduleIndex === Math.floor((clampedProgress / 100) * course.modules.length) ? 'In Progress' : 'Upcoming',
      })),
    }
    return { ...course, progress: 0, status: 'Locked' }
  })
  if (nextCourses[index + 1]) nextCourses[index + 1] = { ...nextCourses[index + 1], status: clampedProgress === 100 ? 'Upcoming' : 'Locked' }
  return { ...candidate, courses: nextCourses }
}

export function completeCourse(candidate, courseId) {
  return updateCourseProgress(candidate, courseId, 100)
}

export function updateCourse(candidate, courseId, update) {
  return {
    ...candidate,
    courses: candidate.courses.map((course) => course.id === courseId ? { ...course, ...update } : course),
  }
}

export function createPersonalLearningRecord(profile) {
  const id = profile?.id ?? 'candidate-demo'
  const name = profile?.full_name || 'Candidate'
  const identifier = profile?.candidate_identifier || `SELF-${id.slice(0, 6).toUpperCase()}`
  const stream = LEARNING_STREAMS.includes(profile?.stream) ? profile.stream : 'Software Development'
  const ownDemo = createCandidateLearningRecord({
    id,
    name,
    cohort: 'Demand 1',
    stream,
    completedCount: 4 + (id.length % 7),
    currentProgress: 5 + ((id.length * 7) % 86),
    seed: id.length,
  })
  ownDemo.candidateIdentifier = identifier
  return readCandidateRecord(id, ownDemo)
}

export function updateModuleCompletion(candidate, courseId, moduleIndex) {
  const course = candidate.courses.find((item) => item.id === courseId)
  if (!course) return candidate
  const progress = Math.min(100, Math.round(((moduleIndex + 1) / course.modules.length) * 100))
  const updated = updateCourseProgress(candidate, courseId, progress)
  return updateCourse(updated, courseId, {
    modules: course.modules.map((module, index) => ({
      ...module,
      status: index <= moduleIndex ? 'Completed' : index === moduleIndex + 1 ? 'In Progress' : 'Upcoming',
    })),
  })
}