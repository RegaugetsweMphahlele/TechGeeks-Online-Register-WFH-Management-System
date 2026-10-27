import { useMemo, useState } from 'react'
import { ArrowLeft, Award, Check, ChevronRight, Circle, LockKeyhole, Play, Sparkles } from 'lucide-react'
import { candidateProgress, completedCourseCount, currentCourse, updateCourse, updateCourseProgress, candidateStatus } from '../lib/mentorLearningDemo.js'
import Button from './ui/Button.jsx'
import { Card, StatCard } from './ui/Card.jsx'

const TABS = ['In Progress', 'Completed', 'Saved', 'Certificates & Badges', 'Skills']

function getFirstName(name) {
  return name?.trim().split(/\s+/)[0] || 'Candidate'
}

function StatusBadge({ status }) {
  const styles = {
    Completed: 'bg-success-surface text-success',
    'In Progress': 'bg-purple-tint text-purple',
    Upcoming: 'border border-purple/40 bg-white text-purple',
    Locked: 'bg-surface-muted text-muted',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? styles.Locked}`}>{status}</span>
}

function ProgressBar({ value, label = 'Course progress' }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Progress</span><span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
        <div className="h-full rounded-full bg-purple transition-[width]" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function CourseNode({ course, index, selected, onSelect }) {
  const complete = course.status === 'Completed'
  const active = course.status === 'In Progress'
  const locked = course.status === 'Locked'
  const circleClass = complete
    ? 'border-success bg-success text-white'
    : active
      ? 'border-purple bg-purple text-white ring-4 ring-purple/15'
      : locked
        ? 'border-kadet-20 bg-surface-muted text-muted'
        : 'border-purple/45 bg-white text-purple'

  return (
    <button type="button" onClick={() => onSelect(course.id)} className={`group grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${selected ? 'bg-purple-tint' : 'hover:bg-bg'}`} aria-current={selected ? 'step' : undefined}>
      <span className={`grid size-9 place-items-center rounded-full border-2 text-sm font-semibold ${circleClass}`}>
        {complete ? <Check className="size-4" aria-label="Completed" /> : locked ? <LockKeyhole className="size-3.5" aria-label="Locked" /> : index + 1}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-sm font-medium ${locked ? 'text-muted' : 'text-ink'}`}>{course.title}</span>
        <span className="mt-0.5 block text-xs text-muted">{active ? `${course.progress}% complete` : complete ? 'Course completed' : course.modules.length + ' lessons'}</span>
      </span>
      <StatusBadge status={course.status} />
    </button>
  )
}

function CoursePanel({ candidate, course, onUpdate, canUpdateProgress }) {
  const completedModules = course.modules.filter((module) => module.status === 'Completed').length
  const onResume = () => {
    const nextProgress = Math.min(100, course.progress + 10)
    onUpdate(updateCourseProgress(candidate, course.id, nextProgress))
  }

  const markModuleComplete = (moduleIndex) => {
    const modules = course.modules.map((module, index) => ({
      ...module,
      status: index <= moduleIndex ? 'Completed' : index === moduleIndex + 1 ? 'In Progress' : module.status,
    }))
    const progress = Math.round((modules.filter((module) => module.status === 'Completed').length / modules.length) * 100)
    const updatedCandidate = updateCourseProgress(candidate, course.id, progress)
    onUpdate(updateCourse(updatedCandidate, course.id, { modules, progress, status: progress === 100 ? 'Completed' : 'In Progress' }))
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line bg-white px-5 py-5 sm:px-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-purple"><Play className="size-4" aria-hidden /> Professional Learning Programme</div>
          <StatusBadge status={course.status} />
        </div>
        <h2 className="max-w-3xl text-xl font-semibold leading-7 sm:text-2xl">{course.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{course.description}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <ProgressBar value={course.progress} />
          <span className="text-sm text-muted">{completedModules} of {course.modules.length} lessons complete</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {canUpdateProgress && <Button onClick={onResume} icon={Play} disabled={course.progress === 100 || course.status === 'Locked'}>{course.status === 'Locked' ? 'Course locked' : course.progress > 0 ? 'Resume demo course' : 'Start demo course'}</Button>}
          <span className="text-xs text-muted">{course.duration} · simulated course data</span>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Course lessons</h3>
          <span className="text-xs text-muted">{course.modules.length} lessons</span>
        </div>
        <ol className="divide-y divide-line rounded-lg border border-line">
          {course.modules.map((module, index) => (
            <li key={module.title} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${module.status === 'Completed' ? 'bg-success-surface text-success' : module.status === 'In Progress' ? 'bg-purple-tint text-purple' : 'bg-bg text-muted'}`}>
                {module.status === 'Completed' ? <Check className="size-4" aria-hidden /> : module.status === 'Locked' ? <LockKeyhole className="size-3.5" aria-hidden /> : <span className="text-xs font-semibold">{index + 1}</span>}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{module.title}</span>
              <StatusBadge status={module.status} />
              {canUpdateProgress && module.status !== 'Completed' && module.status !== 'Locked' && (
                <button type="button" onClick={() => markModuleComplete(index)} className="rounded-md px-2 py-1 text-xs font-semibold text-purple hover:bg-purple-tint">Mark complete</button>
              )}
            </li>
          ))}
        </ol>
        {course.quiz && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-bg px-4 py-3 text-sm">
            {canUpdateProgress ? (
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={course.quiz.completed} onChange={(event) => onUpdate(updateCourse(candidate, course.id, {
                  quiz: { completed: event.target.checked, score: event.target.checked ? (course.quiz.score ?? 80) : null },
                }))} className="size-4 accent-purple" />
                Practice assessment completed
              </label>
            ) : <span className="font-medium">Practice assessment</span>}
            {course.quiz.completed && <span className="text-muted">Demo score {course.quiz.score}%</span>}
          </div>
        )}
      </div>
    </Card>
  )
}

function TabContent({ tab, candidate, selectedCourse, onSelectCourse }) {
  if (tab === 'Skills') {
    return <Card className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Skills in this programme</h2><p className="mt-1 text-sm text-muted">Skills represented by this simulated learning path.</p><div className="mt-5 flex flex-wrap gap-2">{candidate.skills.map((skill) => <span key={skill} className="rounded-full border border-line bg-bg px-3 py-1.5 text-sm">{skill}</span>)}</div></Card>
  }

  if (tab === 'Certificates & Badges') {
    const complete = completedCourseCount(candidate)
    return <Card className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Certificates &amp; Badges</h2><p className="mt-1 text-sm text-muted">Recognition earned in this demo environment.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{complete ? <div className="flex items-center gap-3 rounded-lg border border-line p-4"><span className="grid size-11 place-items-center rounded-full bg-success-surface text-success"><Award className="size-6" /></span><div><p className="font-medium">Learning milestone</p><p className="mt-1 text-xs text-muted">{complete} completed courses</p></div></div> : <p className="text-sm text-muted">Complete a course to earn a demo badge.</p>}</div></Card>
  }

  const courses = tab === 'Completed'
    ? candidate.courses.filter((course) => course.status === 'Completed')
    : tab === 'Saved'
      ? candidate.courses.filter((course) => candidate.savedCourseIds.includes(course.id))
      : candidate.courses

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4 sm:px-6"><h2 className="font-semibold">{tab === 'In Progress' ? 'Your learning path' : tab}</h2><p className="mt-1 text-sm text-muted">{courses.length} courses</p></div>
      <ol className="divide-y divide-line p-2 sm:p-3">
        {courses.map((course) => {
          const index = candidate.courses.findIndex((item) => item.id === course.id)
          return <li key={course.id}><CourseNode course={course} index={index} selected={selectedCourse?.id === course.id} onSelect={onSelectCourse} /></li>
        })}
        {courses.length === 0 && <li className="p-6 text-sm text-muted">No courses in this section yet.</li>}
      </ol>
    </Card>
  )
}

export default function LearningProgressExperience({ candidate, onUpdate, backTo, audience = 'candidate' }) {
  const [tab, setTab] = useState('In Progress')
  const initialCourse = currentCourse(candidate)
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourse?.id)
  const selectedCourse = candidate.courses.find((course) => course.id === selectedCourseId) ?? initialCourse
  const completedCount = completedCourseCount(candidate)
  const progress = candidateProgress(candidate)
  const visibleTab = useMemo(() => tab, [tab])

  return (
    <div className="space-y-5">
      {backTo && <Button to={backTo} variant="secondary" icon={ArrowLeft}>Back to Candidate Learning Progress</Button>}

      <section className="rounded-xl border border-line bg-white px-5 py-6 shadow-card sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-caps text-purple">CAPACITI · DEMO LEARNING ENVIRONMENT</p>
            <h1 className="mt-2 text-2xl font-semibold leading-8 sm:text-3xl">{audience === 'candidate' ? `Good morning, ${getFirstName(candidate.name)}` : `${candidate.name}'s Learning Progress`}</h1>
            <p className="mt-2 text-sm text-muted">{candidate.name} · {candidate.candidateIdentifier || candidate.id} · {candidate.stream || candidate.cohort}</p>
          </div>
          <div className="rounded-lg bg-purple-tint px-3 py-2 text-xs font-semibold text-purple">Simulated progress · Not connected to Coursera</div>
        </div>
        <nav className="mt-6 flex gap-2 overflow-x-auto border-b border-line pb-px" aria-label="Learning sections">
          {TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} aria-current={visibleTab === item ? 'page' : undefined} className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${visibleTab === item ? 'border-purple text-purple' : 'border-transparent text-muted hover:text-ink'}`}>{item}</button>)}
        </nav>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Overall progress" value={`${progress}%`} caption={candidateStatus(candidate)} icon={Circle} tone="purple" />
        <StatCard label="Courses completed" value={`${completedCount} / ${candidate.courses.length}`} caption="Learning path courses" icon={Check} tone="success" />
        <Card as="div" className="flex flex-col gap-2.5 p-5">
          <div className="flex items-center gap-3"><p className="flex-1 text-sm font-medium text-muted">Current course</p><span className="grid size-9 place-items-center rounded-[10px] bg-kadet-tint text-kadet"><Play className="size-5" aria-hidden /></span></div>
          <p className="line-clamp-2 min-h-12 text-sm font-semibold leading-6">{currentCourse(candidate)?.title ?? 'Path complete'}</p>
          <p className="text-xs text-muted">{currentCourse(candidate)?.progress ? `${currentCourse(candidate).progress}% complete` : 'Ready to continue'}</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.5fr)]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="label-caps">Cohort · {candidate.cohort}</p><h2 className="mt-1 text-lg font-semibold">{candidate.stream || candidate.cohort}</h2></div>
            <Sparkles className="size-5 text-purple" aria-hidden />
          </div>
          <TabContent tab={visibleTab} candidate={candidate} selectedCourse={selectedCourse} onSelectCourse={setSelectedCourseId} />
        </div>
        <div className="min-w-0">
          {selectedCourse ? <CoursePanel candidate={candidate} course={selectedCourse} onUpdate={onUpdate} canUpdateProgress={audience === 'candidate'} /> : <Card className="p-8 text-sm text-muted">Select a course from the learning path.</Card>}
          <div className="mt-4 flex items-center gap-2 text-xs text-muted"><ChevronRight className="size-4" aria-hidden />Progress, course states, and badges are simulated demo data and remain in this browser only.</div>
        </div>
      </div>
    </div>
  )
}