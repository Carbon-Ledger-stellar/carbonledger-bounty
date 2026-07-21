'use client';

import Link from 'next/link';
import { useBountyDependencies } from '@/lib/api';

interface PrerequisitesDisplayProps {
  bountyId: string;
}

export function PrerequisitesDisplay({ bountyId }: PrerequisitesDisplayProps) {
  const { data: bountyData, error, isLoading } = useBountyDependencies(bountyId);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-charcoal-700 rounded w-32 mb-2"></div>
        <div className="h-10 bg-charcoal-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
        <p className="text-red-400 text-sm">Failed to load dependencies</p>
      </div>
    );
  }

  if (!bountyData?.prerequisites?.length && !bountyData?.dependents?.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Prerequisites */}
      {bountyData.prerequisites?.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-emerald-100 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Prerequisites
          </h4>
          <div className="space-y-2">
            {bountyData.prerequisites.map((dep) => (
              <PrerequisiteCard
                key={dep.id}
                bounty={dep.prerequisiteBounty}
                isRequired={dep.isRequired}
              />
            ))}
          </div>
          {bountyData.isLocked && (
            <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-yellow-300 font-medium">Bounty Locked</p>
                  <p className="text-yellow-200/80 text-sm mt-1">
                    Complete all required prerequisites before applying to this bounty.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dependents */}
      {bountyData.dependents?.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-emerald-100 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Unlocks
          </h4>
          <div className="space-y-2">
            {bountyData.dependents.map((dep) => (
              <DependentCard
                key={dep.id}
                bounty={dep.dependentBounty}
                isRequired={dep.isRequired}
              />
            ))}
          </div>
          <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <p className="text-emerald-300 font-medium">Unlock Future Bounties</p>
                <p className="text-emerald-200/80 text-sm mt-1">
                  Completing this bounty will unlock {bountyData.dependents.length} additional bounty{bountyData.dependents.length > 1 ? 'ies' : 'y'}.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrerequisiteCard({ bounty, isRequired }: { bounty: any; isRequired: boolean }) {
  if (!bounty) return null;

  const isCompleted = bounty.status === 'closed';

  return (
    <div className={`p-3 rounded-lg border transition-colors ${
      isCompleted
        ? 'bg-emerald-900/20 border-emerald-500/30'
        : 'bg-charcoal-800/50 border-charcoal-600'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link 
              href={`/bounties/${bounty.id}`}
              className="font-medium text-emerald-100 hover:text-emerald-300 transition-colors truncate"
            >
              {bounty.title}
            </Link>
            {!isRequired && (
              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-300 rounded">
                Optional
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            ${bounty.rewardUsd} • {bounty.difficulty}
          </div>
        </div>
        <div className="flex-shrink-0">
          {isCompleted ? (
            <div className="flex items-center gap-1 text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs">Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Pending</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DependentCard({ bounty, isRequired }: { bounty: any; isRequired: boolean }) {
  if (!bounty) return null;

  return (
    <div className="p-3 rounded-lg border bg-charcoal-800/30 border-charcoal-600">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link 
              href={`/bounties/${bounty.id}`}
              className="font-medium text-emerald-100 hover:text-emerald-300 transition-colors truncate"
            >
              {bounty.title}
            </Link>
            {!isRequired && (
              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-300 rounded">
                Soft Dependency
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            ${bounty.rewardUsd} • {bounty.difficulty}
          </div>
        </div>
        <div className="flex-shrink-0">
          <div className="flex items-center gap-1 text-yellow-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs">Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
