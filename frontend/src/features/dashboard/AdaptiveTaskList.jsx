import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckCircleIcon, ExclamationTriangleIcon } from '../../components/AppIcons';

function TaskRow({ item, kind, measuring = false }) {
  const Tag = measuring ? 'div' : 'li';
  const count = kind === 'grouping' || kind === 'progress' ? item.count : null;
  const detail = kind === 'scheduling' ? 'Chưa xếp lịch' : kind === 'grades'
    ? item.nextExamAt ? `Lịch thi: ${new Date(item.nextExamAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : item.detail : null;
  const action = item.action || 'Mở chức năng';
  return <Tag className="od-task-row">
    <div className="od-task-copy"><ExclamationTriangleIcon className="od-task-attention" aria-hidden="true" /><strong title={item.title}>{item.title}</strong>
      {detail && <small title={detail}>{detail}</small>}</div>
    {count != null && <span className="od-count">{count} {item.unit || (kind === 'progress' ? 'buổi' : 'học viên')}</span>}
    {item.href && (measuring ? <span className="od-task-action"><ArrowRightIcon /></span>
      : <Link className="od-task-action" to={item.href} title={`${action}: ${item.title}`} aria-label={`${action}: ${item.title}`}><ArrowRightIcon aria-hidden="true" /></Link>)}
  </Tag>;
}

export default function AdaptiveTaskList({ items, itemCount, href, kind, empty, contextKey }) {
  const viewport = useRef(null), measurements = useRef(null);
  const [capacity, setCapacity] = useState(0);
  useLayoutEffect(() => {
    let frame;
    const measure = () => {
      const space = viewport.current?.clientHeight || 0;
      let used = 0, next = 0;
      for (const row of measurements.current?.children || []) {
        const height = row.getBoundingClientRect().height;
        if (height <= 0 || used + height > space + 0.1) break;
        used += height; next += 1;
      }
      setCapacity(previous => previous === next ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(viewport.current);
    observer?.observe(measurements.current);
    window.addEventListener('resize', schedule);
    measure();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', schedule); };
  }, [items, contextKey]);

  // itemCount is a count of records; count may instead be a count of learners or sessions.
  const total = Number.isInteger(itemCount) && itemCount >= items.length ? itemCount : null;
  const visible = items.slice(0, capacity);
  const hasMore = items.length > visible.length || (total != null && total > visible.length);
  return <div className="od-task-preview" data-visible-count={visible.length} data-loaded-count={items.length}>
    <div className="od-task-viewport" ref={viewport}>
      <div className="od-task-measure" ref={measurements} aria-hidden="true" inert="">
        {items.map(item => <TaskRow key={item.id} item={item} kind={kind} measuring />)}
      </div>
      {!items.length ? <p className="od-empty od-centered-empty"><CheckCircleIcon aria-hidden="true" /><span>{empty}</span></p>
        : <ul className="od-task-list" aria-label="Danh sách công việc">{visible.map(item => <TaskRow key={item.id} item={item} kind={kind} />)}</ul>}
    </div>
    {(items.length > 0 || hasMore) && <div className="od-task-footer">
      {hasMore && <><span>{total == null ? `${visible.length} mục đang hiển thị` : `Hiển thị ${visible.length}/${total} mục`}</span>
        {href && <Link to={href}>Xem tất cả<ArrowRightIcon aria-hidden="true" /></Link>}</>}
    </div>}
  </div>;
}
