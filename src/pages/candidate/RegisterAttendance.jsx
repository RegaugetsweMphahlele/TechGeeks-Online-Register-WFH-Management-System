import { CheckCircle2, LogOut, Timer } from 'lucide-react'
import { useState } from 'react'
import { checkOut, getToday } from '../../api/attendance.js'
import { getWfhForDate } from '../../api/wfh.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import { useToast } from '../../components/Toast.jsx'
import CheckInForm from '../../components/CheckInForm.jsx'
import LocationMap from '../../components/LocationMap.jsx'
import Badge, { ModeBadge } from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Alert, ErrorState, Spinner } from '../../components/ui/Feedback.jsx'
import Modal, { ModalIcon } from '../../components/ui/Modal.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { registerStatus } from '../../lib/attendance.js'
import { friendlyError } from '../../lib/errors.js'
import { formatFullDate, formatHours, formatTime, sastToday } from '../../lib/time.js'

const Item = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-0"><dt className="text-muted">{label}</dt><dd className="text-right">{children}</dd></div>
)

function Summary({ rec }) {
  const s = registerStatus(rec)
  return (
    <dl className="rounded-[10px] bg-bg px-4 py-1">
      <Item label="Status"><ModeBadge mode={rec.work_mode} /></Item>
      <Item label="Check in">{formatTime(rec.check_in_at)}</Item>
      <Item label="Check out">{formatTime(rec.check_out_at)}</Item>
      {rec.check_out_at && <Item label="Hours">{formatHours(rec.hours)}</Item>}
      <Item label="Location">{rec.location_note ?? '—'}</Item>
      <Item label="Detected address">{rec.location_address ?? 'Address unavailable'}</Item>
      {rec.location_latitude != null && <Item label="Coordinates">{Number(rec.location_latitude).toFixed(6)}, {Number(rec.location_longitude).toFixed(6)}</Item>}
      {rec.location_latitude != null && <div className="py-3"><LocationMap latitude={rec.location_latitude} longitude={rec.location_longitude}
        label={rec.location_address || 'Attendance location'} /></div>}
      <Item label="Register"><Badge tone={s.tone}>{s.label}</Badge></Item>
    </dl>
  )
}

export default function RegisterAttendance() {
  const { profile } = useAuth()
  const toast = useToast()
  const today = sastToday()
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([getToday(profile.id), getWfhForDate(profile.id, today)]).then(([rec, wfh]) => ({ rec, wfh })),
    [profile.id, today],
  )
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [confirmOut, setConfirmOut] = useState(false)
  const [result, setResult] = useState(null) // { kind: 'in'|'out', rec }

  async function checkedIn() {
    const rec = await getToday(profile.id) // re-read through the view for hours/approval flags
    setResult({ kind: 'in', rec })
    toast('success', 'Checked in', `Registered at ${formatTime(rec.check_in_at)}.`)
    reload()
  }

  async function doCheckOut() {
    setBusy(true)
    setActionError(null)
    try {
      await checkOut()
      const rec = await getToday(profile.id)
      setConfirmOut(false)
      setResult({ kind: 'out', rec })
      toast('success', 'Checked out', `You worked ${formatHours(rec.hours)} today.`)
      reload()
    } catch (err) {
      setConfirmOut(false)
      setActionError(friendlyError(err))
      reload()
    } finally {
      setBusy(false)
    }
  }

  const rec = data?.rec
  return (
    <>
      <PageHeader title="Register attendance" subtitle={formatFullDate(today)} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,640px)_1fr]">
        <Card className="p-6">
          {error ? <ErrorState message={friendlyError(error)} onRetry={reload} /> : loading && !data ? <Spinner /> : (
            <div className="flex flex-col gap-5">
              {actionError && <Alert type="error" title={actionError} onClose={() => setActionError(null)} />}
              {!rec ? (
                <CheckInForm wfh={data.wfh} onDone={checkedIn} onFailed={reload} />
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-semibold">{rec.check_out_at ? "You're done for today" : "You're checked in"}</h2>
                    <p className="text-xs text-muted">{rec.check_out_at ? 'See you tomorrow.' : 'Remember to check out when you finish work.'}</p>
                  </div>
                  <Summary rec={rec} />
                  <div className="flex flex-wrap gap-3">
                    {!rec.check_out_at && <Button icon={LogOut} onClick={() => setConfirmOut(true)}>Check out</Button>}
                    <Button variant="secondary" icon={Timer} to="/candidate/shifts">Breaks &amp; shift timeline</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
        <aside className="text-xs text-muted lg:pt-2">
          <h2 className="label-caps mb-2">How the register works</h2>
          <ul className="list-disc space-y-1.5 pl-4">
            <li>One register entry per day, in South African time.</li>
            <li>Check-in and check-out times come from the server, not your device.</li>
            <li>Working from home? Submit a WFH request in advance so it can be approved.</li>
          </ul>
        </aside>
      </div>

      <Modal open={confirmOut} onClose={() => setConfirmOut(false)} title="Check out now?" description="You can only check out once per day."
        icon={<ModalIcon icon={LogOut} tone="purple" />}
        footer={<><Button variant="secondary" onClick={() => setConfirmOut(false)}>Cancel</Button><Button loading={busy} onClick={doCheckOut}>Check out</Button></>} />

      <Modal open={Boolean(result)} onClose={() => setResult(null)} icon={<ModalIcon icon={CheckCircle2} />}
        title={result?.kind === 'out' ? 'Checked out' : 'Attendance submitted'}
        description={result?.kind === 'out' ? 'Your day has been recorded.' : 'Your register entry has been recorded.'}
        footer={<><Button variant="secondary" onClick={() => setResult(null)}>Close</Button><Button to="/candidate">Continue</Button></>}>
        {result && <Summary rec={result.rec} />}
      </Modal>
    </>
  )
}
