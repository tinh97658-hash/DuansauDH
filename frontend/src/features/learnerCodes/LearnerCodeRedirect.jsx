import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

export default function LearnerCodeRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set('tab', 'learner-codes');
  return <Navigate to={`/masters/admitted-records?${next}`} replace />;
}
