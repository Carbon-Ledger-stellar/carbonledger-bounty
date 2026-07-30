'use client';

import Link from 'next/link';
import { DependencyGraphVisualizer } from '../../components/DependencyGraph';

export default function DependencyGraphPage() {
  return (
    <main className="min-h-screen bg-charcoal-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <nav className="mb-4">
            <Link
              href="/bounties"
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              ← Back to Bounties
            </Link>
          </nav>
          
          <h1 className="text-3xl font-bold text-emerald-100 mb-2">
            Bounty Dependency Graph
          </h1>
          <p className="text-gray-400 max-w-3xl">
            Visualize the relationship between bounties. Some bounties must be completed before others can be started, 
            creating a dependency chain that ensures proper development order.
          </p>
        </div>

        {/* Graph Visualization */}
        <div className="space-y-6">
          <DependencyGraphVisualizer />
          
          {/* Instructions */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border border-emerald-200/20 rounded-lg bg-charcoal-800/50">
              <h3 className="text-lg font-semibold text-emerald-100 mb-3">
                How Dependencies Work
              </h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span><strong>Required dependencies</strong> (solid lines) must be completed before the dependent bounty can be started</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span><strong>Optional dependencies</strong> (dashed lines) are recommendations but not strict requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span><strong>Locked bounties</strong> cannot be applied to until all required prerequisites are completed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Completing a bounty automatically unlocks any dependent bounties</span>
                </li>
              </ul>
            </div>

            <div className="p-6 border border-emerald-200/20 rounded-lg bg-charcoal-800/50">
              <h3 className="text-lg font-semibold text-emerald-100 mb-3">
                Reading the Graph
              </h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Arrows point from prerequisite to dependent bounty</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Bounties are organized in layers from top to bottom</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Click on any bounty title to view its details</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Prerequisites count shows progress (completed/total)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
