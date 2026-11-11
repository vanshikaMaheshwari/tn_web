'use client';
import { useParams } from 'next/navigation';
import MentorApp from '@/components/mentor/MentorApp';

export default function MentorMenteeCardPage() {
  const { id } = useParams();
  return <MentorApp tab="card" menteeId={id} />;
}
