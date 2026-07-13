'use client';

import { useProjects } from '../../lib/api';
import { formatTonnes } from '../../lib/carbon-utils';
import { colors, spacing } from '../../styles/design-system';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: spacing.xl }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: colors.neutral[900], marginBottom: spacing.lg }}>
        Carbon Projects
      </h1>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.neutral[600] }}>
          Loading projects...
        </div>
      ) : projects && projects.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.lg }}>
          {projects.map((project) => (
            <a
              key={project.id}
              href={`/projects/${project.projectId}`}
              style={{
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                padding: spacing.lg,
                border: `1px solid ${colors.neutral[200]}`,
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                transition: 'all 200ms ease-in-out',
                ':hover': { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
              }}
            >
              <p style={{ fontSize: '0.75rem', color: colors.neutral[500], margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>
                {project.methodology} • {project.country}
              </p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0', color: colors.neutral[900] }}>
                {project.name}
              </h3>
              <p style={{ fontSize: '0.875rem', color: colors.neutral[600], margin: '0.25rem 0' }}>
                Type: {project.projectType}
              </p>
              <p style={{ fontSize: '0.875rem', color: colors.neutral[600], margin: '0.25rem 0' }}>
                Vintage: {project.vintageYear}
              </p>
              <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.neutral[100]}` }}>
                <p style={{ fontSize: '0.875rem', color: colors.neutral[600], margin: '0.25rem 0' }}>
                  Issued: {formatTonnes(project.totalCreditsIssued)}
                </p>
                <p style={{ fontSize: '0.875rem', color: colors.primary[600], fontWeight: 700, margin: '0.25rem 0' }}>
                  Retired: {formatTonnes(project.totalCreditsRetired)}
                </p>
              </div>
              <div
                style={{
                  marginTop: spacing.md,
                  height: '4px',
                  backgroundColor: colors.neutral[200],
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: colors.primary[500],
                    width: `${project.totalCreditsIssued > 0 ? (project.totalCreditsRetired / project.totalCreditsIssued) * 100 : 0}%`,
                  }}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: colors.neutral[600], margin: '0.5rem 0 0', textAlign: 'right' }}>
                {project.totalCreditsIssued > 0
                  ? Math.round((project.totalCreditsRetired / project.totalCreditsIssued) * 100)
                  : 0}
                % retired
              </p>
            </a>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.neutral[600] }}>
          No projects found.
        </div>
      )}
    </div>
  );
}
