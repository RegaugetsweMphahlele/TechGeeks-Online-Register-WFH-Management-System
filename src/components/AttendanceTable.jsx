import { CheckCircle2 } from 'lucide-react'
import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { registerStatus } from '../lib/attendance.js'
import { formatDayLong, formatHours, formatTime } from '../lib/time.js'
import Avatar from './ui/Avatar.jsx'
import Badge, { ModeBadge } from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Modal from './ui/Modal.jsx'
import { Table } from './ui/Table.jsx'
import LocationMap from './LocationMap.jsx'

export function CandidateCell({ name, id }) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        {id && <span className="block text-xs text-muted">{id}</span>}
      </span>
    </span>
  )
}

export default function AttendanceTable({ rows, showCandidate }) {
  const [mapRecord, setMapRecord] = useState(null)
  const columns = [
    showCandidate && { key: 'c', header: 'Candidate', render: (r) => <CandidateCell name={r.full_name} id={r.candidate_identifier} /> },
    { key: 'date', header: 'Date', render: (r) => formatDayLong(r.attendance_date), className: 'whitespace-nowrap' },
    { key: 'in', header: 'Check in', render: (r) => formatTime(r.check_in_at) },
    { key: 'out', header: 'Check out', render: (r) => formatTime(r.check_out_at) },
    { key: 'hours', header: 'Hours', render: (r) => formatHours(r.hours) },
    {
      key: 'mode', header: 'Status',
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <ModeBadge mode={r.work_mode} />
          {r.work_mode === 'wfh' && (r.wfh_approved
            ? <CheckCircle2 className="size-4 text-success" aria-label="WFH approved" />
            : <span className="text-xs whitespace-nowrap text-warning">No approval</span>)}
        </span>
      ),
    },
    { key: 'reg', header: 'Register', render: (r) => { const s = registerStatus(r); return <Badge tone={s.tone}>{s.label}</Badge> } },
    { key: 'loc', header: 'Location', render: (r) => (
      <div className="flex min-w-32 flex-col items-start gap-1">
        <span>{r.location_address || r.location_note || '—'}</span>
        {r.location_latitude != null && <Button size="s" variant="ghost" icon={MapPin} onClick={() => setMapRecord(r)}>View map</Button>}
      </div>
    ) },
  ].filter(Boolean)
  return (
    <>
      <Table columns={columns} rows={rows} caption="Attendance records" />
      <Modal open={Boolean(mapRecord)} onClose={() => setMapRecord(null)} title="Attendance location"
        description={mapRecord?.location_address || mapRecord?.location_note}>
        {mapRecord && <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">{Number(mapRecord.location_latitude).toFixed(6)}, {Number(mapRecord.location_longitude).toFixed(6)}</p>
          <LocationMap latitude={mapRecord.location_latitude} longitude={mapRecord.location_longitude}
            label={mapRecord.location_address || 'Attendance location'} />
        </div>}
      </Modal>
    </>
  )
}
