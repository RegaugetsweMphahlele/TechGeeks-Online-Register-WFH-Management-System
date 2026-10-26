import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

const isAction = (c) => typeof c.header !== 'string' // sr-only headers mark button columns

/**
 * Figma "Table": label-caps headers on muted background. Shows every column when the container is at least
 * `minWidth` wide; below that each row becomes a card (first column as the title, the rest as labelled fields,
 * actions last), so nothing needs horizontal scrolling. The choice follows the container, not the viewport.
 */
export function Table({ columns, rows, rowKey = 'id', onRowClick, caption, minWidth = columns.length * 120 }) {
  const ref = useRef(null)
  const [stacked, setStacked] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    const check = () => setStacked(el.clientWidth < minWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [minWidth])

  const cell = (c, r) => (c.render ? c.render(r) : r[c.key])
  const [first, ...rest] = columns

  return (
    <div ref={ref}>
      {stacked ? (
        <ul aria-label={caption}>
          {rows.map((r) => (
            <li key={r[rowKey]} onClick={onRowClick && (() => onRowClick(r))}
              className={`flex flex-col gap-3 border-t border-line px-4 py-4 first:border-0 sm:px-6 ${onRowClick ? 'cursor-pointer hover:bg-bg' : ''}`}>
              <div className="min-w-0 font-medium">{cell(first, r)}</div>
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(125px,1fr))] gap-x-4 gap-y-3">
                {rest.filter((c) => !isAction(c)).map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="label-caps">{c.header}</dt>
                    <dd className="mt-0.5 wrap-anywhere">{cell(c, r)}</dd>
                  </div>
                ))}
              </dl>
              {rest.some(isAction) && (
                <div className="flex flex-wrap gap-2">{rest.filter(isAction).map((c) => <div key={c.key}>{cell(c, r)}</div>)}</div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-bg">
            {/* `relative` keeps sr-only headers inside the table instead of widening the page */}
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={`label-caps relative px-3 py-3 align-bottom first:pl-6 last:pr-6 ${c.className ?? ''}`}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r[rowKey]}
                className={`border-t border-line ${onRowClick ? 'cursor-pointer hover:bg-bg focus-within:bg-bg' : ''}`}
                onClick={onRowClick && (() => onRowClick(r))}
              >
                {columns.map((c) => <td key={c.key} className={`px-3 py-3 align-middle first:pl-6 last:pr-6 [&_[data-line]]:flex-nowrap ${c.className ?? ''}`}>{cell(c, r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Several small labelled values in one cell, e.g. Late 1 · Early 0. */
export function CellLines({ items }) {
  return (
    <dl className="grid gap-0.5 text-xs">
      {items.map(([label, value]) => (
        <div key={label} data-line className="flex flex-wrap gap-x-1.5"><dt className="whitespace-nowrap text-muted">{label}</dt><dd className="whitespace-nowrap font-medium text-ink">{value}</dd></div>
      ))}
    </dl>
  )
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-6" aria-label="Pagination">
      <span>{from}–{Math.min(page * pageSize, total)} of {total}</span>
      <div className="flex items-center gap-1">
        <button className="rounded-lg p-2 hover:bg-bg disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2">Page {page} of {pages}</span>
        <button className="rounded-lg p-2 hover:bg-bg disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  )
}
