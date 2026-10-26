import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { checkIn } from '../api/attendance.js'
import { friendlyError } from '../lib/errors.js'
import { isWeekend, sastToday } from '../lib/time.js'
import LocationCapture from './LocationCapture.jsx'
import Button from './ui/Button.jsx'
import { Alert } from './ui/Feedback.jsx'
import { Input, Select, Textarea } from './ui/Field.jsx'

const OFFICE = 'CAPACITI office'

/** The one check-in (= clock-in) form, used by Register Attendance and Shifts. The server stamps the time. */
export default function CheckInForm({ wfh, title = 'Check in for today', submitLabel = 'Check in', onDone, onFailed }) {
  const today = sastToday()
  const [form, setForm] = useState({ workMode: '', location: '', notes: '' })
  const [deviceLocation, setDeviceLocation] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const set = (k) => (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, [k]: v, ...(k === 'workMode' && { location: v === 'office' ? OFFICE : f.location === OFFICE ? '' : f.location }) }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    const v = {}
    if (!form.workMode) v.workMode = 'Select your attendance status'
    if (!form.location.trim()) v.location = 'Tell us where you are working from'
    if (!deviceLocation) v.deviceLocation = 'Get your current location before checking in'
    setErrors(v)
    if (Object.keys(v).length) return
    setBusy(true)
    setActionError(null)
    try {
      await checkIn({ ...form, deviceLocation })
      await onDone()
    } catch (err) {
      setActionError(friendlyError(err))
      onFailed?.() // e.g. already checked in on another device → show the real state
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {actionError && <Alert type="error" title={actionError} onClose={() => setActionError(null)} />}
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-muted">Your time is recorded by the server when you submit, not by your device.</p>
      </div>
      {isWeekend(today) && <Alert type="info" title="It's the weekend">You can still register if you're working today.</Alert>}
      <Select label="Attendance status" required value={form.workMode} onChange={set('workMode')} error={errors.workMode}>
        <option value="" disabled>Select status</option>
        <option value="office">Office</option>
        <option value="wfh">Working From Home</option>
      </Select>
      {form.workMode === 'wfh' && (wfh?.status === 'approved'
        ? <Alert type="success" title="WFH approved for today">Approved by {wfh.reviewer_name}.</Alert>
        : <Alert type="warning" title={wfh?.status === 'pending' ? 'Your WFH request for today is still pending' : "You don't have an approved WFH request for today"}>
            You can still check in; your Tech Champion will see that it wasn't approved.
          </Alert>)}
      <Input label="Location" required value={form.location} onChange={set('location')} error={errors.location} maxLength={120}
        placeholder={form.workMode === 'wfh' ? 'e.g. Home – Mitchells Plain' : OFFICE} hint="Self-reported; not location tracking." />
      {errors.deviceLocation && <Alert type="error" title={errors.deviceLocation} />}
      <LocationCapture location={deviceLocation} onChange={(value) => { setDeviceLocation(value); setErrors((current) => ({ ...current, deviceLocation: undefined })) }} required />
      <Textarea label="Notes" rows={3} maxLength={500} value={form.notes} onChange={set('notes')} placeholder="Optional" />
      <Button type="submit" icon={ClipboardCheck} loading={busy} className="self-start">{submitLabel}</Button>
    </form>
  )
}
